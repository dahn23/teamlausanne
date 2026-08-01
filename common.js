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

// Redirige vers l'accueil si pas de session. Renvoie la session sinon.
export async function requireLogin() {
  const session = await getSession();
  if (!session) { location.href = "index.html"; return null; }
  return session;
}
