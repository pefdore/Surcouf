-- ══════════════════════════════════════════════════════════════
-- Journée des Voisins — Rue Surcouf, Rennes
-- Schéma PostgreSQL / Neon — à exécuter dans le SQL Editor Neon
-- (https://console.neon.tech → ton projet → SQL Editor)
--
-- ATTENTION : remplace MON_MOT_DE_PASSE par un mot de passe solide
-- avant d'exécuter, et garde-le pour js/config.js.
-- ══════════════════════════════════════════════════════════════

-- Inscriptions des foyers
CREATE TABLE IF NOT EXISTS rsvps (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom        TEXT   NOT NULL UNIQUE,
  adultes    INT    NOT NULL DEFAULT 1 CHECK (adultes BETWEEN 1 AND 20),
  enfants    INT    NOT NULL DEFAULT 0 CHECK (enfants BETWEEN 0 AND 20),
  moments    TEXT   NOT NULL DEFAULT '' CHECK (length(moments) <= 60),
  apport     TEXT   NOT NULL DEFAULT '' CHECK (length(apport) <= 200),
  message    TEXT   NOT NULL DEFAULT '' CHECK (length(message) <= 400),
  edit_code  TEXT   NOT NULL DEFAULT '' CHECK (edit_code  <= 64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Missions « qui organise quoi »
CREATE TABLE IF NOT EXISTS missions (
  title        TEXT PRIMARY KEY,
  responsable  TEXT NOT NULL DEFAULT '' CHECK (length(responsable) <= 120),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Les 13 missions de la fête
INSERT INTO missions (title) VALUES
  ('Sonner aux portes'),
  ('Autorisation mairie'),
  ('Tables & chaises'),
  ('Déco & guirlandes'),
  ('Café d''accueil'),
  ('Jeux de l''après-midi'),
  ('Chasse au trésor « Le Renard »'),
  ('Bar de l''apéro'),
  ('Sono & micro ouvert'),
  ('Musiciens'),
  ('Photos & vidéo'),
  ('Tri & rangement'),
  ('Sécurité douce')
ON CONFLICT (title) DO NOTHING;

-- Rôle applicatif restreint, utilisé par le site (/js/config.js).
-- Il peut lire/écrire les inscriptions et réclamer les missions,
-- mais ne peut rien supprimer ni toucher au schéma.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'voisin_app') THEN
    CREATE ROLE voisin_app LOGIN PASSWORD 'MON_MOT_DE_PASSE';
  END IF;
END
$do$;
ALTER ROLE voisin_app LOGIN PASSWORD 'MON_MOT_DE_PASSE';
GRANT USAGE ON SCHEMA public TO voisin_app;
GRANT SELECT, INSERT, UPDATE ON rsvps    TO voisin_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO voisin_app;
GRANT SELECT, UPDATE         ON missions TO voisin_app;
REVOKE ALL ON rsvps, missions FROM PUBLIC;

-- Quelques données de départ (optionnel — le site affiche la liste
-- telle quelle, tu peux aussi tout saisir via le formulaire).
INSERT INTO rsvps (nom, adultes, enfants, moments, apport, message, edit_code) VALUES
  ('Famille Le Goff · n° 12', 3, 2, 'apero,banquet', 'Un far breton et 4 chaises', 'On arrive dès l''apéro, les gamins adorent la chasse au trésor !', ''),
  ('Marie & Julien · n° 27', 2, 0, 'aprem,apero,banquet', 'Kir Breton + guirlandes solaires', '', '')
ON CONFLICT (nom) DO NOTHING;
