/* ══════════════════════════════════════════════════════════════
   Configuration de la base Neon.
   ══════════════════════════════════════════════════════════════

   1. Crée (ou réutilise) un projet sur https://console.neon.tech
   2. Exécute db/schema.sql dans le SQL Editor (après avoir remplacé
      MON_MOT_DE_PASSE par un vrai mot de passe)
   3. Colle ci-dessous la chaîne de connexion du rôle `voisin_app`,
      au format :
      postgresql://voisin_app:MOT_DE_PASSE@ep-xxxx-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require

   Tant que NEON_URL est vide, le site fonctionne en mode démo :
   les données restent dans le localStorage du navigateur.

   Note sécurité : ce rôle est volontairement bridé (écriture
   uniquement sur rsvps/missions, aucune suppression). Voir
   db/schema.sql pour les détails et how-to-durcir si besoin.
   ══════════════════════════════════════════════════════════════ */

window.SURCOUF_CONFIG = {
  NEON_URL: ""
};
