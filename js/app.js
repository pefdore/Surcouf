/* ══════════════════════════════════════════════════════════════
   Journée des Voisins — Rue Surcouf, Rennes
   Dynamique : base Neon via le driver serverless officiel (HTTP).
   Repli automatique en mode démo (localStorage) sans configuration.
   ══════════════════════════════════════════════════════════════ */

"use strict";

const EVENT_DATE = new Date("2027-05-28T14:00:00+02:00");
const STORE_RSVP = "surcouf-rsvp-v1";
const STORE_BOARD = "surcouf-board-v1";
const NEON_URL = (window.SURCOUF_CONFIG && window.SURCOUF_CONFIG.NEON_URL) || "";

/* ─────────── Utilitaires ─────────── */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function toast(html) {
  const el = $("#toast");
  el.innerHTML = html;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 3600);
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function save(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ }
}

function initials(name) {
  return (name.trim().split(/\s+/).map(w => w[0]).join("") || "?").slice(0, 2).toUpperCase();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII"];

/* ─────────── Backend : Neon (HTTP) ou démo localStorage ─────────── */
const DB = {
  mode: "demo", // "neon" | "demo"
  sql: null,

  async init() {
    if (!NEON_URL) return this;
    try {
      const { neon } = await import("https://esm.sh/@neondatabase/serverless@0.16.4");
      this.sql = neon(NEON_URL, { arrayMode: true });
      await this.sql`SELECT 1`;
      this.mode = "neon";
    } catch (e) {
      console.warn("Base Neon injoignable, mode démo activé.", e);
      this.mode = "demo";
    }
    return this;
  },

  norm(nom) { return nom.trim().toLowerCase(); },

  momentToCode(m) { return m === "Après-midi" ? "aprem" : m === "Apéro" ? "apero" : (m === "Banquet" || m === "Barbecue") ? "banquet" : ""; },
  momentFromCode(c) { return c === "aprem" ? "Après-midi" : c === "apero" ? "Apéro" : c === "banquet" ? "Barbecue" : c; },

  async listRsvps() {
    if (this.mode === "neon") {
      const rows = await this.sql`SELECT nom, adultes, enfants, moments, apport, message FROM rsvps ORDER BY created_at`;
      return rows.map(r => ({
        nom: r[0], adultes: Number(r[1]), enfants: Number(r[2]),
        moments: (r[3] || "").split(",").filter(Boolean).map(c => this.momentFromCode(c)),
        apport: r[4] || "", msg: r[5] || ""
      }));
    }
    return load(STORE_RSVP, []);
  },

  async saveRsvp(entry) {
    if (this.mode === "neon") {
      const code = await sha256(entry.edit_code || entry.nom.toLowerCase());
      const moments = entry.moments.map(m => this.momentToCode(m)).filter(Boolean).join(",");
      const rows = await this.sql`
        INSERT INTO rsvps (nom, adultes, enfants, moments, apport, message, edit_code)
        VALUES (${entry.nom}, ${entry.adultes}, ${entry.enfants}, ${moments}, ${entry.apport}, ${entry.msg}, ${code})
        ON CONFLICT (nom) DO UPDATE SET
          adultes = excluded.adultes, enfants = excluded.enfants,
          moments = excluded.moments, apport = excluded.apport,
          message = excluded.message, edit_code = excluded.edit_code,
          updated_at = now()
        WHERE rsvps.edit_code = ${code} OR rsvps.edit_code = ''
        RETURNING nom`;
      return rows.length > 0;
    }
    let rsvps = load(STORE_RSVP, []);
    const i = rsvps.findIndex(r => this.norm(r.nom) === this.norm(entry.nom));
    if (i >= 0) rsvps[i] = entry; else rsvps.push(entry);
    save(STORE_RSVP, rsvps);
    return true;
  },

  async deleteRsvp(nom, edit_code) {
    if (this.mode === "neon") {
      const code = await sha256(edit_code);
      const rows = await this.sql`
        DELETE FROM rsvps WHERE nom = ${nom.trim()} AND edit_code = ${code} RETURNING nom`;
      return rows.length > 0;
    }
    let rsvps = load(STORE_RSVP, []);
    const n = rsvps.length;
    rsvps = rsvps.filter(r => this.norm(r.nom) !== this.norm(nom));
    save(STORE_RSVP, rsvps);
    return rsvps.length < n;
  },

  async needsCode(nom) {
    if (this.mode !== "neon") return false;
    const rows = await this.sql`SELECT edit_code FROM rsvps WHERE nom = ${nom.trim()}`;
    if (!rows.length || rows[0][0] === "" || rows[0][0] === null) return false;
    return true;
  },

  async listMissions() {
    if (this.mode === "neon") {
      const rows = await this.sql`SELECT title, responsable FROM missions`;
      return TASKS.map(t => ({
        title: t.title,
        responsable: (rows.find(r => r[0] === t.title) || ["", ""])[1] || ""
      }));
    }
    const board = load(STORE_BOARD, {});
    return TASKS.map(t => ({ title: t.title, responsable: board[t.title] || "" }));
  },

  async claimMission(title, responsable) {
    if (this.mode === "neon") {
      if (responsable) {
        const rows = await this.sql`
          UPDATE missions SET responsable = ${responsable}, updated_at = now()
          WHERE title = ${title} AND responsable = '' RETURNING title`;
        return rows.length > 0;
      }
      await this.sql`UPDATE missions SET responsable = '', updated_at = now() WHERE title = ${title}`;
      return true;
    }
    const board = load(STORE_BOARD, {});
    if (responsable) board[title] = responsable; else delete board[title];
    save(STORE_BOARD, board);
    return true;
  }
};

/* ─────────── Manifeste des missions ─────────── */
const TASKS = [
  { title: "Sonner aux portes", desc: "Distribuer les flyers dans toutes les boîtes aux lettres de la rue (2 semaines avant)." },
  { title: "Autorisation mairie", desc: "Demander la réservation piétonne de la rue à Rennes Ville & Métropole (1 mois avant)." },
  { title: "Tables & chaises", desc: "Recenser et monter les tables pliantes et bancs le matin du 29." },
  { title: "Déco & guirlandes", desc: "Fanions, nappes, guirlandes lumineuses et dénomination des rues en corsaire." },
  { title: "Café d'accueil", desc: "Urnes de café, thé, jus et crêpes pour l'ouverture à 14h." },
  { title: "Jeux de l'après-midi", desc: "Mölkky, palets, pétanque, ping-pong et gestion du tableau des scores." },
  { title: "Chasse au trésor « Le Renard »", desc: "Préparer les indices, cacher le trésor et encadrer les équipes d'enfants." },
  { title: "Bar de l'apéro", desc: "Table des boissons : kir breton, softs, glaçons, gobelets réutilisables." },
  { title: "Sono & micro ouvert", desc: "Enceinte, micro sans fil et playlist de marine pour les chansons de marins." },
  { title: "Musiciens", desc: "Brancher un instrument pour le concert de 22h et embarquer les voisins." },
  { title: "Photos & vidéo", desc: "Shooter la photo officielle de la rue et immortaliser la journée." },
  { title: "Tri & rangement", desc: "Sacs de tri, point de propreté et grand rangement collectif à 23h." },
  { title: "Sécurité douce", desc: "Circulation aux extrémités de la rue, assistance aux personnes âgées et aux enfants." }
];

/* Données de démo (mode localStorage) */
const DEMO_RSVP = [
  { nom: "Famille Le Goff · n° 12", adultes: 3, enfants: 2, moments: ["Apéro", "Barbecue"], apport: "Un far breton et 4 chaises", msg: "On arrive dès l'apéro, les gamins adorent la chasse au trésor !" },
  { nom: "Marie & Julien · n° 27", adultes: 2, enfants: 0, moments: ["Après-midi", "Apéro", "Barbecue"], apport: "Kir Breton + guirlandes solaires", msg: "" },
  { nom: "Yves · n° 5", adultes: 1, enfants: 0, moments: ["Apéro"], apport: "Mölkky et palets bretons", msg: "Je tiens la table de pétanque à la mêlée." }
];

/* ─────────── Reveal au scroll ─────────── */
const observer = new IntersectionObserver(
  (entries) => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("visible"); observer.unobserve(e.target); }
  }),
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);
$$(".reveal").forEach(el => observer.observe(el));

/* ─────────── Nav ─────────── */
const nav = $("#nav");
const progressBar = $("#progressBar");
const burger = $("#burger");
const navLinks = $(".nav-links");

burger.addEventListener("click", () => {
  burger.classList.toggle("open");
  navLinks.classList.toggle("open");
});
navLinks.addEventListener("click", (e) => {
  if (e.target.tagName === "A") { burger.classList.remove("open"); navLinks.classList.remove("open"); }
});

window.addEventListener("scroll", () => {
  const sc = window.scrollY;
  nav.classList.toggle("scrolled", sc > 20);
  const h = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.width = (h > 0 ? (sc / h) * 100 : 0) + "%";
}, { passive: true });

/* ─────────── Countdown ─────────── */
const cd = { d: $("#cdDays"), h: $("#cdHours"), m: $("#cdMin"), s: $("#cdSec") };
const pad = (n) => String(n).padStart(2, "0");

function tick() {
  const diff = EVENT_DATE - Date.now();
  if (diff <= 0) {
    cd.d.textContent = "0"; cd.h.textContent = "00"; cd.m.textContent = "00"; cd.s.textContent = "00";
    return;
  }
  cd.d.textContent = Math.floor(diff / 864e5);
  cd.h.textContent = pad(Math.floor(diff / 36e5) % 24);
  cd.m.textContent = pad(Math.floor(diff / 6e4) % 60);
  cd.s.textContent = pad(Math.floor(diff / 1e3) % 60);
}
tick();
setInterval(tick, 1000);

/* ─────────── Rendu : inscriptions ─────────── */
let rsvps = [];

function totalPersonnes() {
  return rsvps.reduce((n, r) => n + (r.adultes || 0) + (r.enfants || 0), 0);
}

function renderRsvps() {
  const list = $("#rsvpList");
  const empty = $("#rsvpEmpty");
  list.innerHTML = "";
  rsvps.forEach((r, i) => {
    const li = document.createElement("li");
    li.className = "rsvp-item";
    li.style.animationDelay = (i * 0.06) + "s";
    const moments = (r.moments && r.moments.join(" · ").toLowerCase()) || "présence à confirmer";
    li.innerHTML = `
      <div class="rsvp-item-top">
        <span class="rsvp-avatar">${escapeHtml(initials(r.nom))}</span>
        <h4>${escapeHtml(r.nom)}</h4>
        <button class="rsvp-del" title="Retirer mon inscription" data-nom="${escapeHtml(r.nom)}">✕</button>
      </div>
      <div class="rsvp-item-meta">${r.adultes} adulte(s)${r.enfants ? " · " + r.enfants + " enfant(s)" : ""} — ${escapeHtml(moments)}</div>
      ${r.apport ? `<div class="rsvp-item-apport"><span>Apport</span>${escapeHtml(r.apport)}</div>` : ""}
      ${r.msg ? `<div class="rsvp-item-msg">${escapeHtml(r.msg)}</div>` : ""}
    `;
    list.appendChild(li);
  });
  empty.style.display = rsvps.length ? "none" : "block";
  $("#rsvpCount").textContent = `${totalPersonnes()} personne(s) · ${rsvps.length} foyer(s)`;
  $("#statInscrits").textContent = totalPersonnes();
  renderStats();
}

$("#rsvpList").addEventListener("click", async (e) => {
  const btn = e.target.closest(".rsvp-del");
  if (!btn) return;
  const nom = btn.dataset.nom;
  const code = prompt(`Retirer « ${nom} » ?\nIndique le code d'accès choisi à l'inscription (ou laisse vide en mode démo).`);
  if (code === null) return;
  try {
    const ok = await DB.deleteRsvp(nom, code);
    if (ok) {
      await refreshRsvps();
      toast("Inscription retirée — à l'année prochaine peut-être.");
    } else {
      toast("Code d'accès incorrect : inscription conservée.");
    }
  } catch {
    toast("La base est momentanément injoignable. Réessaie dans un instant.");
  }
});

$("#rsvpForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nom = $("#fNom").value.trim();
  if (!nom) {
    toast("Indique un prénom ou un nom de foyer pour vous inscrire.");
    $("#fNom").focus();
    return;
  }
  const moments = $$('input[name="moments"]:checked').map(c => c.value);
  const entry = {
    nom,
    adultes: Math.max(1, Number($("#fAdultes").value) || 1),
    enfants: Math.max(0, Number($("#fEnfants").value) || 0),
    moments,
    apport: $("#fApport").value.trim(),
    msg: $("#fMsg").value.trim()
  };
  try {
    let edit_code = nom.toLowerCase();
    if (DB.mode === "neon" && await DB.needsCode(nom)) {
      const asked = prompt(`« ${nom} » est déjà inscrit. Indique le code d'accès choisi lors de la première inscription pour le modifier.`);
      if (asked === null) return;
      if (asked) edit_code = asked;
    }
    entry.edit_code = edit_code;
    const saved = await DB.saveRsvp(entry);
    if (saved === false && DB.mode === "neon") {
      toast("Modification refusée : code d'accès incorrect.");
      return;
    }
    await refreshRsvps();
    e.target.reset();
    $("#fAdultes").value = 2;
    $("#fEnfants").value = 0;
    toast(`Merci, <b>${escapeHtml(entry.nom)}</b> — on vous attend le vendredi 28 mai 2027.`);
  } catch (err) {
    console.warn(err);
    toast("La base est momentanément injoignable. Réessaie dans un instant.");
  }
});

$("#btnPrint").addEventListener("click", () => window.print());

/* ─────────── Rendu : missions ─────────── */
let missions = [];

function renderBoard() {
  const boardEl = $("#board");
  boardEl.innerHTML = "";
  TASKS.forEach((t, i) => {
    const m = missions.find(x => x.title === t.title) || { responsable: "" };
    const card = document.createElement("article");
    card.className = "task";
    card.innerHTML = `
      <div class="task-top">
        <h4>${escapeHtml(t.title)}</h4>
        <span class="task-num">${ROMAN[i] ?? i + 1}</span>
      </div>
      <p>${escapeHtml(t.desc)}</p>
      ${m.responsable
        ? `<span class="task-taken">${escapeHtml(m.responsable)}</span>`
        : `<button class="btn-claim" data-task="${escapeHtml(t.title)}">Je m'en charge&nbsp;!</button>`}
    `;
    boardEl.appendChild(card);
  });
  renderStats();
}

function renderStats() {
  const taken = missions.filter(m => m.responsable).length;
  $("#statTaches").textContent = `${taken}/${TASKS.length}`;
}

$("#board").addEventListener("click", async (e) => {
  const btn = e.target.closest(".btn-claim");
  if (!btn) return;
  const task = btn.dataset.task;
  const nom = prompt(`« ${task} » : qui s'en charge ?\n(Prénom, foyer ou numéro)`);
  if (!nom || !nom.trim()) return;
  try {
    const ok = await DB.claimMission(task, nom.trim());
    if (!ok) await refreshMissions();
    else await refreshMissions();
    if (ok) toast(`Merci <b>${escapeHtml(nom.trim())}</b> — « ${escapeHtml(task)} » vous revient.`);
    else toast("Mission déjà prise par un autre voisin — la liste vient d'être rafraîchie.");
  } catch {
    toast("La base est momentanément injoignable. Réessaie dans un instant.");
  }
});

$("#btnResetBoard").addEventListener("click", async () => {
  if (!confirm("Libérer toutes les missions du tableau ?")) return;
  try {
    for (const t of TASKS) await DB.claimMission(t.title, "");
    await refreshMissions();
    toast("Tableau réinitialisé.");
  } catch {
    toast("La base est momentanément injoignable. Réessaie dans un instant.");
  }
});

$("#btnExport").addEventListener("click", () => {
  const rows = [
    ["Foyer", "Adultes", "Enfants", "Présence", "Apport", "Message"],
    ...rsvps.map(r => [r.nom, r.adultes, r.enfants, (r.moments || []).join(" / "), r.apport, r.msg]),
    [],
    ["Mission", "Responsable"],
    ...TASKS.map(t => {
      const m = missions.find(x => x.title === t.title);
      return [t.title, (m && m.responsable) || "—"];
    })
  ];
  const csv = rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "journee-voisins-rue-surcouf.csv";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Liste exportée en CSV — à ouvrir dans Excel ou LibreOffice.");
});

/* ─────────── Rafraîchissement ─────────── */
async function refreshRsvps() {
  rsvps = await DB.listRsvps();
  renderRsvps();
}
async function refreshMissions() {
  missions = await DB.listMissions();
  renderBoard();
}

function initDemoIfEmpty() {
  if (DB.mode === "demo" && !load(STORE_RSVP, null)) {
    save(STORE_RSVP, DEMO_RSVP);
    const board = load(STORE_BOARD, {});
    board["Café d'accueil"] = "Solène · n° 9";
    board["Sono & micro ouvert"] = "Théo · n° 14A";
    save(STORE_BOARD, board);
  }
}

/* ─────────── Init ─────────── */
(async () => {
  await DB.init();
  initDemoIfEmpty();
  await refreshRsvps();
  await refreshMissions();
  if (DB.mode === "neon") document.body.classList.add("mode-live");
})();
