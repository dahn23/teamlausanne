// password-reset — « Mot de passe oublié » pour app.teamlausanne.ch (console et Mon espace). Publique (pas de JWT).
//   • action "request" : { email } -> si un compte existe, envoie un lien valable 1 heure depuis info@teamlausanne.ch.
//     La réponse est TOUJOURS la même, que le compte existe ou non (on ne révèle pas qui a un compte).
//     Freins anti-abus : 3 demandes par adresse et par heure, 40 demandes par heure au total.
//   • action "info"    : { token } -> { ok, email } si le lien est valable.
//   • action "reset"   : { token, password } -> pose le nouveau mot de passe, consomme le jeton.
// Jeton maison (table password_resets) plutôt qu'un lien Supabase : même mécanique que l'activation de Mon espace,
// et le mail part de notre boîte (Hostpoint), pas du service d'envoi limité de Supabase.
import nodemailer from "npm:nodemailer@6.9.14";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });

const FROM = (Deno.env.get("GMAIL_HUB") || "info@teamlausanne.ch").trim();
const APP = "https://app.teamlausanne.ch";
const HOSTPOINT_DOMAINS = ["teamlausanne.ch"];
const isHostpoint = (addr: string) => HOSTPOINT_DOMAINS.includes((String(addr).toLowerCase().split("@")[1] || ""));
const smtpHost = (addr: string) => (isHostpoint(addr) ? "asmtp.mail.hostpoint.ch" : "smtp.gmail.com");
const cleanPass = (addr: string, v: string) => (isHostpoint(addr) ? String(v || "").trim() : String(v || "").replace(/\s+/g, ""));
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAME = { ok: true, message: "Si un compte existe pour cette adresse, un mail vient de partir. Pense à regarder dans les indésirables." };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || "");

    if (action === "request") {
      const email = String(payload.email || "").trim().toLowerCase();
      if (!isEmail(email)) return json({ error: "Adresse e-mail invalide." }, 400);
      const since = new Date(Date.now() - 3600 * 1000).toISOString();
      const { count: mine } = await supa.from("password_resets").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since);
      const { count: all } = await supa.from("password_resets").select("id", { count: "exact", head: true }).gte("created_at", since);
      if ((mine || 0) >= 3 || (all || 0) >= 40) return json(SAME);   // frein silencieux : même réponse
      const { data: ex } = await supa.rpc("portal_user_by_email", { p_email: email });
      const uid: string | null = ex?.[0]?.user_id || null;
      if (!uid) return json(SAME);
      const { data: row, error: ie } = await supa.from("password_resets").insert({ user_id: uid, email }).select("token").single();
      if (ie || !row) return json(SAME);
      const pass = cleanPass(FROM, Deno.env.get("GMAIL_APP_PASSWORD") || "");
      if (!pass) return json(SAME);
      const link = `${APP}/reset.html?t=${row.token}`;
      const text = `Bonjour,\n\nTu as demandé un nouveau mot de passe pour ton accès Team Lausanne (${email}).\n\nChoisis-le ici (lien valable 1 heure) :\n${link}\n\nSi tu n'es pas à l'origine de cette demande, ignore simplement ce mail : ton mot de passe actuel reste valable.\n\nTeam Lausanne`;
      const html = `<div style="font-family:system-ui,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:560px"><p>Bonjour,</p><p>Tu as demandé un nouveau mot de passe pour ton accès Team Lausanne (${email}).</p><p><a href="${link}" style="display:inline-block;background:#123cc4;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">Choisir un nouveau mot de passe</a><br><span style="font-size:12px;color:#6b7280">Lien valable 1 heure — ou copie : ${link}</span></p><p>Si tu n'es pas à l'origine de cette demande, ignore simplement ce mail : ton mot de passe actuel reste valable.</p><p>Team Lausanne</p></div>`;
      try {
        const tx = nodemailer.createTransport({ host: smtpHost(FROM), port: 465, secure: true, auth: { user: FROM, pass } });
        await tx.sendMail({ from: `"Team Lausanne" <${FROM}>`, to: email, subject: "Ton nouveau mot de passe — Team Lausanne", text, html });
      } catch (_e) { /* même réponse : on ne révèle rien */ }
      return json(SAME);
    }

    const token = String(payload.token || "").trim();
    const BAD = "Ce lien n'est pas valable ou a expiré. Refais une demande de mot de passe oublié.";
    if (!UUID.test(token)) return json({ error: BAD }, 400);
    const { data: r } = await supa.from("password_resets").select("id,user_id,email,used_at,expires_at").eq("token", token).maybeSingle();
    if (!r || r.used_at || new Date(r.expires_at).getTime() < Date.now()) return json({ error: BAD }, 410);

    if (action === "info") return json({ ok: true, email: r.email });

    if (action === "reset") {
      const password = String(payload.password || "");
      if (password.length < 8) return json({ error: "Le mot de passe doit faire au moins 8 caractères." }, 400);
      if (password.length > 72) return json({ error: "Mot de passe trop long (72 caractères maximum)." }, 400);
      // Le lien est arrivé par mail : l'adresse est donc vérifiée (utile pour un compte invité jamais activé).
      const { error } = await supa.auth.admin.updateUserById(r.user_id, { password, email_confirm: true });
      if (error) return json({ error: "Changement impossible : " + error.message }, 400);
      await supa.from("password_resets").update({ used_at: new Date().toISOString() }).eq("id", r.id);
      // Les autres liens encore ouverts pour ce compte ne servent plus.
      await supa.from("password_resets").update({ used_at: new Date().toISOString() }).eq("user_id", r.user_id).is("used_at", null);
      return json({ ok: true, email: r.email });
    }

    return json({ error: "action inconnue" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
