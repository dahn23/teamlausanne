// portal-invite — invitations des familles à « Mon espace » (pilote sport-études + pro, puis ouverture générale).
//
// DEUX actions, et un VERROU :
//   • action "test" : envoie le mail d'invitation à l'adresse de CELUI QUI CLIQUE (et à personne d'autre), avec un
//     lien d'exemple. Sert à relire le texte. Ne crée aucun compte, n'écrit rien.
//   • action "send" : invite réellement les familles listées. REFUSÉE tant que l'interrupteur
//     portal_invite_config.sending_enabled est éteint (il l'est par défaut, et seul un superadmin peut l'allumer).
//
// Le lien d'activation est NOTRE jeton (table portal_invites, valable 30 jours) et non un lien Supabase, qui expire
// en 1 à 24 h — trop court pour un parent qui ouvre son mail trois jours plus tard. La page activer.html + la fonction
// portal-activate posent ensuite le mot de passe choisi par la famille.
import nodemailer from "npm:nodemailer@6.9.14";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });

// Expéditeur = la boîte principale (secret GMAIL_HUB = info@teamlausanne.ch, mot de passe GMAIL_APP_PASSWORD).
const FROM = (Deno.env.get("GMAIL_HUB") || "info@teamlausanne.ch").trim();
const APP = "https://app.teamlausanne.ch";
const MAX_BATCH = 40;
// Même règle de serveur que les autres fonctions mail : @teamlausanne.ch est chez Hostpoint.
const HOSTPOINT_DOMAINS = ["teamlausanne.ch"];
const isHostpoint = (addr: string) => HOSTPOINT_DOMAINS.includes((String(addr).toLowerCase().split("@")[1] || ""));
const smtpHost = (addr: string) => (isHostpoint(addr) ? "asmtp.mail.hostpoint.ch" : "smtp.gmail.com");
const cleanPass = (addr: string, v: string) => (isHostpoint(addr) ? String(v || "").trim() : String(v || "").replace(/\s+/g, ""));
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const esc = (t: string) => String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// « Léa », « Léa et Tom », « Léa, Tom et Max »
const joinNames = (n: string[]) => (n.length <= 1 ? (n[0] || "votre enfant") : n.slice(0, -1).join(", ") + " et " + n[n.length - 1]);
const fill = (s: string, m: Record<string, string>) => String(s || "").replace(/\{(\w+)\}/g, (mm, k) => (m[k] != null ? m[k] : mm));
function toHtml(text: string, link: string) {
  const parts = esc(text).split(esc(link));
  const btn = `<a href="${esc(link)}" style="display:inline-block;background:#123cc4;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">Activer Mon espace</a><br><span style="font-size:12px;color:#6b7280">ou copie ce lien : ${esc(link)}</span>`;
  const body = parts.join(btn).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
  return `<div style="font-family:system-ui,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:560px"><p>${body}</p></div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const pass = cleanPass(FROM, Deno.env.get("GMAIL_APP_PASSWORD") || "");
    if (!pass) return json({ error: "secret mail manquant" }, 400);

    // Appelant : admin ou superadmin, identifié par son jeton.
    const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: ures } = await asUser.auth.getUser();
    const me = ures?.user;
    if (!me?.id) return json({ error: "non authentifié" }, 401);
    const supa = createClient(url, service);
    const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", me.id);
    const isAdmin = (roles || []).some((r: { role: string }) => ["superadmin", "admin"].includes(r.role));
    if (!isAdmin) return json({ error: "réservé aux administrateurs" }, 403);

    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || "");
    const { data: cfg } = await supa.from("portal_invite_config").select("*").eq("id", 1).maybeSingle();
    if (!cfg) return json({ error: "réglages d'invitation introuvables" }, 500);
    const tx = nodemailer.createTransport({ host: smtpHost(FROM), port: 465, secure: true, auth: { user: FROM, pass } });

    // ---- TEST : uniquement vers l'adresse de celui qui clique ----
    if (action === "test") {
      const to = String(me.email || "").trim();
      if (!isEmail(to)) return json({ error: "ton compte n'a pas d'adresse e-mail" }, 400);
      const sample = isEmail(String(payload.email || "")) ? String(payload.email).trim() : "";
      let names = ["Léa", "Tom"];
      if (sample) {
        const { data: fam } = await supa.rpc("portal_family_of_email", { p_email: sample });
        if ((fam || []).length) names = (fam || []).map((p: { first_name: string }) => p.first_name);
      }
      const link = `${APP}/activer.html?t=exemple`;
      const vars = { prenoms: joinNames(names), lien: link, email: sample || to };
      const text = fill(cfg.body, vars);
      await tx.sendMail({ from: `"Team Lausanne" <${FROM}>`, to, subject: "[TEST] " + fill(cfg.subject, vars), text, html: toHtml(text, link) });
      return json({ ok: true, test: true, to });
    }

    // ---- ENVOI RÉEL : verrouillé par l'interrupteur ----
    if (action === "send") {
      if (!cfg.sending_enabled) return json({ error: "Les envois sont désactivés (interrupteur « Envois activés » éteint). Rien n'est parti." }, 423);
      if (payload.confirm !== "ENVOYER") return json({ error: "confirmation manquante" }, 400);
      const rawList: unknown[] = Array.isArray(payload.emails) ? payload.emails : [];
      const emails: string[] = [...new Set<string>(rawList.map((e) => String(e || "").trim().toLowerCase()).filter(isEmail))];
      if (!emails.length) return json({ error: "aucune adresse" }, 400);
      if (emails.length > MAX_BATCH) return json({ error: `maximum ${MAX_BATCH} familles par envoi` }, 400);

      const report: { email: string; status: string }[] = [];
      for (const email of emails) {
        try {
          const { data: fam } = await supa.rpc("portal_family_of_email", { p_email: email });
          const kids = (fam || []) as { person_id: string; first_name: string }[];
          if (!kids.length) { report.push({ email, status: "aucun jeune de la saison à cette adresse" }); continue; }
          const { data: ex } = await supa.rpc("portal_user_by_email", { p_email: email });
          let uid: string | null = ex?.[0]?.user_id || null;
          if (ex?.[0]?.activated) { report.push({ email, status: "compte déjà actif — pas d'invitation" }); continue; }
          if (!uid) {
            // Compte créé SANS e-mail Supabase, avec un mot de passe aléatoire que personne ne connaît :
            // la famille choisira le sien sur activer.html.
            const { data: cu, error: ce } = await supa.auth.admin.createUser({ email, password: crypto.randomUUID() + crypto.randomUUID(), email_confirm: false });
            if (ce || !cu?.user?.id) { report.push({ email, status: "création du compte impossible : " + (ce?.message || "?") }); continue; }
            uid = cu.user.id;
          }
          const { data: prof } = await supa.from("profiles").select("user_id").eq("user_id", uid).maybeSingle();
          if (!prof) await supa.from("profiles").insert({ user_id: uid, person_id: kids[0].person_id });
          const { data: inv, error: ie } = await supa.from("portal_invites")
            .insert({ email, person_ids: kids.map((k) => k.person_id), user_id: uid, created_by: me.id }).select("id,token").single();
          if (ie || !inv) { report.push({ email, status: "journal impossible : " + (ie?.message || "?") }); continue; }
          const link = `${APP}/activer.html?t=${inv.token}`;
          const vars = { prenoms: joinNames(kids.map((k) => k.first_name)), lien: link, email };
          const text = fill(cfg.body, vars);
          await tx.sendMail({ from: `"Team Lausanne" <${FROM}>`, to: email, replyTo: FROM, subject: fill(cfg.subject, vars), text, html: toHtml(text, link) });
          await supa.from("portal_invites").update({ sent_at: new Date().toISOString() }).eq("id", inv.id);
          report.push({ email, status: "invitation envoyée" });
        } catch (e) {
          report.push({ email, status: "erreur : " + String((e as Error)?.message || e) });
        }
      }
      return json({ ok: true, sent: report.filter((r) => r.status === "invitation envoyée").length, report });
    }

    return json({ error: "action inconnue" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
