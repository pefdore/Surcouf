# Surcouf

Site web de la **Journée des Voisins — rue Surcouf, Rennes**, calée sur la Fête des Voisins nationale du vendredi 28 mai 2027.

## Démarrage rapide

Site 100 % statique servi par GitHub Pages : <https://pefdore.github.io/Surcouf/>

Sans configuration, le site tourne en **mode démo** : inscriptions et missions sont stockées dans le navigateur (localStorage).

## Passer en dynamique (base Neon)

Inscriptions et missions partagées entre tous les voisins via une base [Neon](https://console.neon.tech) :
le site interroge la base directement depuis le navigateur avec le driver officiel
[`@neondatabase/serverless`](https://neon.com/docs/serverless/serverless-driver) (HTTP, zéro backend à héberger).

1. **Crée un projet** sur [console.neon.tech](https://console.neon.tech) (offre gratuite).
2. **Exécute `db/schema.sql`** dans le SQL Editor du projet — remplace d'abord `MON_MOT_DE_PASSE`
   par un mot de passe solide (il crée les tables `rsvps` et `missions`, les 13 missions, et le
   rôle applicatif restreint `voisin_app`).
3. **Renseigne la chaîne de connexion** du rôle `voisin_app` dans `js/config.js` :
   ```
   postgresql://voisin_app:MOT_DE_PASSE@ep-xxxx-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
   Puis pousse la mise à jour (`main` puis `gh-pages`).

Le site détecte la configuration au chargement et bascule automatiquement en mode dynamique ;
en cas d'indisponibilité de la base, il retombe en mode démo.

### Fonctionnement

- **Qui vient** : chaque foyer s'inscrit (adultes, enfants, moments de présence, apport, message).
  Une inscription existante ne peut être modifiée ou retirée qu'avec le **code d'accès** choisi
  à la première inscription (vérifié côté base en SHA-256).
- **Qui organise quoi** : 13 missions revendicables en un clic, sans doublon (premier arrivé).
- **Export CSV** de la liste complète (inscriptions + missions).
- **Administrer la base** : [console.neon.tech](https://console.neon.tech) → ton projet → SQL Editor ou Tables.

### Sécurité, en deux mots

Le rôle `voisin_app` est volontairement bridé : lecture/écriture sur les deux tables
seulement, aucune suppression, aucun accès au schéma. Les identifiants vivent dans le
JavaScript public : c'est acceptable pour un site de quartier, mais n'y mets rien de sensible,
et pense à suspendre le compute Neon après la fête (bouton *Suspend*).

## Structure

- `index.html` — page unique (histoire, programme, inscriptions, missions)
- `css/styles.css` — design sobre & chic (ivoire / encre / bronze)
- `js/app.js` — logique : countdown, RSVP, missions, export, repli démo
- `js/config.js` — chaîne de connexion Neon (vide = mode démo)
- `db/schema.sql` — schéma PostgreSQL + rôle applicatif + données de départ

## Crédits & sources

Historique : WikiRennes (dossier « Rue Surcouf », délibérations municipales, Archives de Rennes) ·
Inventaire général du patrimoine culturel — [patrimoine.bzh](https://patrimoine.bzh).
Date calée sur la Fête des Voisins nationale — [fetedesvoisins.fr](https://www.fetedesvoisins.fr).
