// Socle commun : client Supabase + helpers d'accès, partagés par toutes les pages.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const STAFF_ROLES = ["superadmin", "admin", "secretaire", "head_coach", "coach", "coach_physique", "moniteur"];
export const ADMIN_ROLES = ["superadmin", "admin", "secretaire"];
// Tous les rôles qui ouvrent la console (staff élargi : coachs, profs, mental, officiels…).
export const CONSOLE_ROLES = ["superadmin", "admin", "secretaire", "head_coach", "coach", "coach_physique", "moniteur", "prof", "coach_mental", "organisateur", "responsable", "affichage"];

export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

// MES rôles uniquement : filtrés sur mon user_id. (Sans ce filtre, un admin — autorisé par la RLS à lire
// les accès de tout le monde — « héritait » à l'écran des rôles de tous les utilisateurs, superadmin compris.)
export async function myRoles() {
  const session = await getSession();
  const uid = session?.user?.id;
  if (!uid) return [];
  const { data } = await sb.from("user_roles").select("role").eq("user_id", uid);
  return (data || []).map((r) => r.role);
}

export const hasAny = (roles, allowed) => roles.some((r) => allowed.includes(r));

// Destination après connexion selon le rôle : staff → console, sinon → espace membre.
// « console » est réécrit vers admin.html par Netlify (l'URL affichée reste /console).
export function landingFor(roles) {
  if (!hasAny(roles || [], CONSOLE_ROLES)) return "espace.html";
  // Staff qui est AUSSI joueur ou parent : on rouvre le dernier espace utilisé (bouton de bascule en haut de page).
  return lastSpace() === "espace" ? "espace.html" : "/console";
}
// Dernier espace choisi via le bouton de bascule Console ⇄ Mon espace (mémorisé sur l'appareil).
export function lastSpace() { try { return localStorage.getItem("tl-space") || ""; } catch (_e) { return ""; } }
export function rememberSpace(s) { try { localStorage.setItem("tl-space", s); } catch (_e) { /* navigation privée */ } }

// ---- Dates en français : JJ-MM-AAAA (partout sur le site) ----
const pad2 = (n) => String(n).padStart(2, "0");
export function frDate(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(String(d).length <= 10 ? String(d) + "T00:00:00" : d);
  if (isNaN(dt)) {
    const s = String(d).slice(0, 10).split("-");
    return s.length === 3 ? `${s[2]}.${s[1]}.${s[0]}` : String(d);
  }
  return `${pad2(dt.getDate())}.${pad2(dt.getMonth() + 1)}.${dt.getFullYear()}`;
}
export function frDateTime(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return frDate(d);
  return `${pad2(dt.getDate())}.${pad2(dt.getMonth() + 1)}.${dt.getFullYear()} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}
// Pluriel correct : « 1 jour », « 5 jours »
export const jours = (d) => `${d} jour${d > 1 ? "s" : ""}`;

// Redirige vers l'accueil si pas de session. Renvoie la session sinon.
export async function requireLogin() {
  const session = await getSession();
  if (!session) { location.href = "/"; return null; }
  return session;
}

// ===================================================================
//  App native (coquille Capacitor, dossier mobile/) : notifications du téléphone
//  Le site tourne dans le navigateur interne de l'app, où les notifications « navigateur » (web push) n'existent pas.
//  On passe donc par le pont natif que Capacitor injecte dans la page (window.Capacitor) : le téléphone obtient un
//  jeton Firebase, qu'on enregistre dans push_devices ; le serveur (fonction push-native) envoie vers ces jetons.
//  Hors de l'app (Chrome, Safari, ordinateur), tout ceci ne fait rien.
// ===================================================================
export const isNativeApp = () => { try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (_e) { return false; } };
const NATIVE_TOKEN_KEY = "tl-native-push-token";
let nativePushStarted = false;

export async function initNativePush() {
  if (!isNativeApp() || nativePushStarted) return;
  const cap = window.Capacitor, P = "PushNotifications";
  if (!cap.nativePromise || !cap.nativeCallback) return;
  nativePushStarted = true;
  try {
    // Le téléphone a obtenu (ou renouvelé) son jeton : on le rattache au compte connecté.
    cap.nativeCallback(P, "addListener", { eventName: "registration" }, async (t) => {
      const token = t && t.value; if (!token) return;
      try { localStorage.setItem(NATIVE_TOKEN_KEY, token); } catch (_e) { /* stockage indisponible */ }
      const platform = cap.getPlatform && cap.getPlatform() === "ios" ? "ios" : "android";
      const { error } = await sb.rpc("push_register_device", { p_token: token, p_platform: platform });
      if (error) console.warn("push_register_device :", error.message);
    });
    cap.nativeCallback(P, "addListener", { eventName: "registrationError" }, (e) => console.warn("Notifications natives :", e && e.error));
    // Tap sur une notification : on ouvre la page indiquée (chemin du même site uniquement).
    cap.nativeCallback(P, "addListener", { eventName: "pushNotificationActionPerformed" }, (a) => {
      const url = a && a.notification && a.notification.data && a.notification.data.url;
      if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//") && location.pathname + location.search !== url) location.href = url;
    });
    // Canal Android « important » : sans lui, la notification arrive sans bandeau ni son.
    try { await cap.nativePromise(P, "createChannel", { id: "general", name: "Notifications", description: "Mails, cours, news", importance: 5, visibility: 1 }); } catch (_e) { /* iOS : pas de canaux */ }
    let perm = await cap.nativePromise(P, "checkPermissions", {});
    if (perm && perm.receive !== "granted") perm = await cap.nativePromise(P, "requestPermissions", {});
    if (perm && perm.receive === "granted") await cap.nativePromise(P, "register", {});
  } catch (e) { console.warn("Notifications natives indisponibles :", e && e.message ? e.message : e); }
}

// À appeler AVANT sb.auth.signOut() : ce téléphone ne doit plus recevoir les notifications du compte qui se déconnecte.
export async function releaseNativePush() {
  if (!isNativeApp()) return;
  let token = ""; try { token = localStorage.getItem(NATIVE_TOKEN_KEY) || ""; } catch (_e) { /* rien */ }
  if (token) { try { await sb.rpc("push_unregister_device", { p_token: token }); } catch (_e) { /* hors ligne */ } }
  nativePushStarted = false;
}
