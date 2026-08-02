// Edge function : inviter un membre par email (création de compte).
// Sécurité : n'accepte que les appels d'un admin. Utilise la clé service
// (disponible en variable d'environnement de la fonction, jamais côté site).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // 1) L'appelant doit être admin
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: uErr } = await caller.auth.getUser();
  if (uErr || !user) return json({ error: "Non authentifié." }, 401);
  const { data: roles } = await caller.from("user_roles").select("role").eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "superadmin");
  if (!isAdmin) return json({ error: "Accès refusé (admin requis)." }, 403);

  // 2) Inviter par email
  const { person_id, email, redirectTo } = await req.json().catch(() => ({}));
  if (!email) return json({ error: "Email manquant." }, 400);

  const admin = createClient(url, service);
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(
    email, redirectTo ? { redirectTo } : undefined);
  if (error) return json({ error: error.message }, 400);

  // 3) Relier le compte à la fiche membre
  if (person_id && invited?.user?.id) {
    await admin.from("profiles").upsert({ user_id: invited.user.id, person_id });
  }
  return json({ ok: true, user_id: invited?.user?.id });
});
