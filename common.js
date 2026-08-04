// Socle commun : client Supabase + helpers d'accès, partagés par toutes les pages.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const STAFF_ROLES = ["superadmin", "admin", "secretaire", "head_coach", "coach"];
export const ADMIN_ROLES = ["superadmin", "admin", "secretaire"];

export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function myRoles() {
  const { data } = await sb.from("user_roles").select("role");
  return (data || []).map((r) => r.role);
}

export const hasAny = (roles, allowed) => roles.some((r) => allowed.includes(r));

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
  if (!session) { location.href = "index.html"; return null; }
  return session;
}
