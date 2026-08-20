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
