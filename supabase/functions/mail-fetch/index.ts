// mail-fetch — bouton « Relever » de la console : relève immédiate.
// v19 (18.09.2026) : ne parle plus lui-même à la boîte mail. Il vérifie que l'appelant est du staff,
// puis déclenche mail-cron (la relève automatique), qui sait quelle boîte est chez Hostpoint ou chez Gmail.
// Une seule logique de relève à maintenir, et le bouton fait exactement ce que fait le cron.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version, *",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const STAFF = ["superadmin", "admin", "secretaire", "head_coach", "coach", "coach_physique", "moniteur"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    if (!cronSecret) return json({ error: "Secret CRON_SECRET manquant dans Supabase." }, 400);

    const authHeader = req.headers.get("Authorization") || "";
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: ures } = await asUser.auth.getUser();
    const uid = ures?.user?.id;
    if (!uid) return json({ error: "non authentifie" }, 401);
    const supa = createClient(url, service);
    const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", uid);
    if (!(roles || []).some((r: { role: string }) => STAFF.includes(r.role))) return json({ error: "reserve au staff" }, 403);

    const res = await fetch(`${url}/functions/v1/mail-cron`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cron-secret": cronSecret },
      body: "{}",
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out?.error) return json({ error: out?.error || `releve impossible (${res.status})` }, 502);
    const errs = Object.entries(out?.errors || {}).map(([a, m]) => `${a} : ${m}`);
    if (errs.length && !(out.inserted > 0)) return json({ error: errs.join(" ; ") }, 502);
    return json({ ok: true, inserted: out.inserted || 0, sent: out.sent || 0, archived: out.archived || 0, errors: out.errors || {} });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
