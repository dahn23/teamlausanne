// Edge function : récupère la liste des tournois publiés sur le système
// Advantage de Swiss Tennis (comp.swisstennis.ch) via le login CLUB/MEMBRE.
// Identifiants lus depuis les secrets Supabase (ST_CLUB_ID, ST_CLUB_PWD),
// jamais dans le site ni le code. Réservé aux admins.
//
// Version RECONNAISSANCE : renvoie le HTML brut de la liste pour écrire le
// parseur. (Le parsing + enregistrement en base viendront ensuite.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const BASE = "https://comp.swisstennis.ch/advantage/servlet";
const cookieOf = (res: Response) => (res.headers.get("set-cookie") || "").split(";")[0];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Auth : admin uniquement
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json({ error: "Non authentifié." }, 401);
  const { data: roles } = await caller.from("user_roles").select("role").eq("user_id", user.id);
  if (!(roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "superadmin"))
    return json({ error: "Accès refusé (admin requis)." }, 403);

  const id = Deno.env.get("ST_CLUB_ID");
  const pwd = Deno.env.get("ST_CLUB_PWD");
  if (!id || !pwd) return json({ error: "Secrets ST_CLUB_ID / ST_CLUB_PWD non configurés dans Supabase." }, 400);

  try {
    // 1) Récupérer un cookie de session
    const r1 = await fetch(`${BASE}/MyTournamentList?lang=F`, { redirect: "manual" });
    let cookie = cookieOf(r1);

    // 2) Login club/membre (bouton "Mitglied")
    const body = new URLSearchParams({ Lang: "F", id, pwd, Mitglied: "" }).toString();
    const r2 = await fetch(`${BASE}/Login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
      body, redirect: "manual",
    });
    const c2 = cookieOf(r2);
    if (c2) cookie = c2;

    // 3) Charger la liste des tournois
    const r3 = await fetch(`${BASE}/MyTournamentList?lang=F`, { headers: { Cookie: cookie } });
    const html = await r3.text();
    const loggedIn = !/Login Zone/i.test(html);
    return json({ ok: true, loggedIn, status: r3.status, length: html.length, html: html.slice(0, 60000) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
