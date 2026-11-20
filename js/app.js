/* ═════════════════════════════════════════════════
   Journée des Voisins — Rue Surcouf, Rennes
   Logique : countdown, RSVP, tableau des missions
   Persistance : localStorage (aucune donnée envoyée)
   ═════════════════════════════════════════════════ */

"use strict";

const EVENT_DATE = new Date("2027-05-28T14:00:00+02:00");
const STORE_RSVP = "surcouf-rsvp-v1";
const STORE_BOARD = "surcouf-board-v1";

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

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII"];

function initials(name) {
  return (name.trim().split(/\s+/).map(w => w[0]).join("") || "?").slice(0, 2).toUpperCase();
}

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

/* ─────────── Historique des inscriptions ─────────── */
let rsvps = load(STORE_RSVP, [
  { id: 1, nom: "Famille Le Goff · n° 12", adultes: 3, enfants: 2, moments: ["Apéro", "Banquet"], apport: "Un far breton et 4 chaises", msg: "On arrive dès l'apéro, les gamins adorent la chasse au trésor !" },
  { id: 2, nom: "Marie & Julien · n° 27", adultes: 2, enfants: 0, moments: ["Après-midi", "Apéro", "Banquet"], apport: "Kir Breton + guirlandes solaires", msg: "" },
  { id: 3, nom: "Yves · n° 5", adultes: 1, enfants: 0, moments: ["Apéro"], apport: "Mölkky et palets bretons", msg: "Je tiens la table de pétanque à la mêlée." }
]);

function totalPersonnes() {
  return rsvps.reduce((n, r) => n + r.adultes + r.enfants, 0);
}

function renderRsvps() {
  const list = $("#rsvpList");
  const empty = $("#rsvpEmpty");
  list.innerHTML = "";
  rsvps.forEach((r, i) => {
    const li = document.createElement("li");
    li.className = "rsvp-item";
    li.style.animationDelay = (i * 0.06) + "s";
    const moments = r.moments.map(m => ({
      "Après-midi": "après-midi",
      "Apéro": "apéro",
      "Banquet": "banquet"
    }[m] || m)).join(" · ") || "présence à confirmer";
    li.innerHTML = `
      <div class="rsvp-item-top">
        <span class="rsvp-avatar">${initials(r.nom)}</span>
        <h4>${escapeHtml(r.nom)}</h4>
        <button class="rsvp-del" title="Retirer mon inscription" data-id="${r.id}">✕</button>
      </div>
      <div class="rsvp-item-meta">${r.adultes} adulte(s)${r.enfants ? " · " + r.enfants + " enfant(s)" : ""} — ${moments}</div>
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

$("#rsvpList").addEventListener("click", (e) => {
  const btn = e.target.closest(".rsvp-del");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const r = rsvps.find(x => x.id === id);
  if (r && confirm(`Retirer l'inscription de « ${r.nom} » ?`)) {
    rsvps = rsvps.filter(x => x.id !== id);
    save(STORE_RSVP, rsvps);
    renderRsvps();
    toast("Inscription retirée — à l'année prochaine peut-être.");
  }
});

$("#rsvpForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const nom = $("#fNom").value.trim();
  if (!nom) {
    toast("Indiquez un prénom ou un nom de foyer pour vous inscrire.");
    $("#fNom").focus();
    return;
  }
  const moments = $$('input[name="moments"]:checked').map(c => c.value);
  const entry = {
    id: Date.now(),
    nom,
    adultes: Math.max(1, Number($("#fAdultes").value) || 1),
    enfants: Math.max(0, Number($("#fEnfants").value) || 0),
    moments,
    apport: $("#fApport").value.trim(),
    msg: $("#fMsg").value.trim()
  };
  const existing = rsvps.findIndex(r => r.nom.toLowerCase() === nom.toLowerCase());
  if (existing >= 0) {
    rsvps[existing] = entry;
    toast(`<b>${escapeHtml(entry.nom)}</b>, votre inscription a été mise à jour. Merci !`);
  } else {
    rsvps.push(entry);
    toast(`Merci, <b>${escapeHtml(entry.nom)}</b> — on vous attend le vendredi 28 mai 2027.`);
  }
  save(STORE_RSVP, rsvps);
  renderRsvps();
  e.target.reset();
  $("#fAdultes").value = 2;
  $("#fEnfants").value = 0;
});

$("#btnPrint").addEventListener("click", () => window.print());

/* ─────────── Tableau « qui organise quoi » ─────────── */
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
  { title: "Musiciens", desc: "Brancher un instrument pour le concert de 21h30 et embarquer les voisins." },
  { title: "Photos & vidéo", desc: "Shooter la photo officielle de la rue et immortaliser la journée." },
  { title: "Tri & rangement", desc: "Sacs de tri, point de propreté et grand rangement collectif à 23h." },
  { title: "Sécurité douce", desc: "Circulation aux extrémités de la rue, assistance aux personnes âgées et aux enfants." }
];

let board = load(STORE_BOARD, {});
const DEMO_TAKEN = { "Café d'accueil": "Solène · n° 9", "Sono & micro ouvert": "Théo · n° 14A" };
Object.assign(board, { ...board, ...DEMO_TAKEN });

const boardEl = $("#board");
function renderBoard() {
  boardEl.innerHTML = "";
  TASKS.forEach((t, i) => {
    const taken = board[t.title];
    const card = document.createElement("article");
    card.className = "task";
    card.style.animationDelay = (i * 0.05) + "s";
    card.innerHTML = `
      <div class="task-top">
        <span class="task-num">${ROMAN[i] ?? i + 1}</span>
        <h4>${t.title}</h4>
      </div>
      <p>${t.desc}</p>
      ${taken
        ? `<span class="task-taken">${escapeHtml(taken)}</span>`
        : `<button class="btn-claim" data-task="${escapeHtml(t.title)}">Je m'en charge&nbsp;!</button>`}
    `;
    boardEl.appendChild(card);
  });
  renderStats();
}

function renderStats() {
  const taken = Object.keys(board).length;
  $("#statTaches").textContent = `${taken}/${TASKS.length}`;
}

boardEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-claim");
  if (!btn) return;
  const task = btn.dataset.task;
  const nom = prompt(`« ${task} » : qui s'en charge ?\n(Indiquez votre prénom, foyer ou numéro)`);
  if (nom && nom.trim()) {
    board[task] = nom.trim();
    save(STORE_BOARD, board);
    renderBoard();
    toast(`Merci <b>${escapeHtml(nom.trim())}</b> — « ${escapeHtml(task)} » vous revient.`);
  }
});

$("#btnResetBoard").addEventListener("click", () => {
  if (confirm("Réinitialiser toutes les missions du tableau ?")) {
    board = {};
    save(STORE_BOARD, board);
    renderBoard();
    toast("Tableau réinitialisé.");
  }
});

$("#btnExport").addEventListener("click", () => {
  const rows = [
    ["Foyer", "Adultes", "Enfants", "Présence", "Apport", "Message"],
    ...rsvps.map(r => [r.nom, r.adultes, r.enfants, r.moments.join(" / "), r.apport, r.msg]),
    [],
    ["Mission", "Responsable"],
    ...TASKS.map(t => [t.title, board[t.title] || "—"])
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

/* ─────────── Init ─────────── */
renderRsvps();
renderBoard();
