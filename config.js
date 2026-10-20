// Configuration Supabase (clé publiable = sans danger côté client ; la sécurité
// des données est assurée par les règles RLS côté base).
export const SUPABASE_URL = "https://lnrmtwamuaqcubohontn.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_nsRKXBFgwmDjtmvS3mFc0w_Q4pi_qxK";

// Plage horaire affichée dans la grille (heures pleines).
export const HOUR_START = 8;   // 08:00
export const HOUR_END   = 22;  // dernier créneau 21:00–22:00

// Notifications push (OneSignal). Laisser vide tant que le compte OneSignal
// n'est pas créé : le portail reste installable (PWA) sans notifs.
// Quand tu as l'App ID OneSignal, colle-le ici → les notifs s'activent.
export const ONESIGNAL_APP_ID = "";

// Site public (teamlausanne.ch). Mon espace y pointe pour les actualités :
// les images des articles et les liens « lire sur le site » vivent là-bas,
// pas sur le domaine de l'app — un chemin relatif ne mènerait nulle part.
export const SITE_PUBLIC = "https://teamlausanne.ch";

// Saison d'enseignement (onglet Calendrier de Mon espace). Ce ne sont PAS les
// dates de la table seasons, qui court du 20 août au 19 août pour les besoins
// administratifs : ici c'est la saison vécue, celle des calendriers PDF.
// À mettre à jour chaque été, en même temps que les PDF.
export const SAISON_COURS = { label: "2026-2027", reprise: "2026-08-31", fin: "2027-07-02", semaines: 35 };

// Nos réseaux, affichés sur l'accueil de Mon espace. Une entrée vide n'est pas
// affichée : mettre l'adresse ici suffit à faire apparaître l'icône, et à la
// faire disparaître si le compte ferme.
export const RESEAUX = {
  instagram: "https://www.instagram.com/lausanne_sports_tennis",
  tiktok: "https://www.tiktok.com/@team_lausanne",
  google: "https://www.google.com/maps/search/?api=1&query=Team+Lausanne+Academy+Route+des+Plaines-du-Loup+7+1018+Lausanne",
  site: "https://teamlausanne.ch",
};
