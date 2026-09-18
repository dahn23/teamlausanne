import nodemailer from "npm:nodemailer@6.9.14";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const TOURNOI = "tournoi@teamlausanne.ch";
const CODE_VESTIAIRE = "2848#";
// Liste des tournois GameZone sur mytennis ({lien_tournois} + repli de {url_tournoi}).
const GZ_LIST = "https://www.mytennis.ch/fr/tournois?keyword=gamezone";
// {url_tournoi} = page mytennis du tournoi, derivee du swiss_id (ex. "Id159321" -> .../159321).
// L'URL saisie manuellement (registration_url) reste prioritaire ; sinon repli sur la liste.
const tournoiUrl = (t: { registration_url?: string | null; swiss_id?: string | null }) =>
  (t.registration_url && t.registration_url.trim()) ||
  (t.swiss_id ? `https://www.mytennis.ch/fr/tournois/${String(t.swiss_id).replace(/\D/g, "")}` : GZ_LIST);
const BATCH = 30;
// Serveurs par boîte (18.09.2026) : les adresses @teamlausanne.ch sont chez Hostpoint (Cloud Office),
// les autres boîtes restent chez Gmail. Un mot de passe d'application Gmail s'écrit avec des espaces ;
// un mot de passe Hostpoint se prend tel quel.
const HOSTPOINT_DOMAINS = ["teamlausanne.ch"];
const isHostpoint = (addr: string) => HOSTPOINT_DOMAINS.includes((String(addr).toLowerCase().split("@")[1] || ""));
const smtpHost = (addr: string) => (isHostpoint(addr) ? "asmtp.mail.hostpoint.ch" : "smtp.gmail.com");
const cleanPass = (addr: string, v: string) => (isHostpoint(addr) ? String(v || "").trim() : String(v || "").replace(/\s+/g, ""));
const fillVars = (s: string, m: Record<string, string>) => String(s || "").replace(/\{(\w+)\}/g, (mm, k) => (m[k] != null ? m[k] : mm));
const toHtml = (t: string) => "<p>" + String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>") + "</p>";

// deno-lint-ignore no-explicit-any
function recipientIds(key: string, entries: any[], status: any[], epreuve: string | null): string[] {
  const absent = new Set(status.filter((s) => s.absent).map((s) => s.participant_id));
  if (key.startsWith("welcome")) return [...new Set(entries.filter((e) => e.confirmed).map((e) => e.participant_id))];
  if (key === "non_selection") {
    // Non-sélectionné = pas confirmé dans un tableau qui a des confirmés (sinon le tableau est annulé),
    // ET confirmé dans AUCUN autre tableau du tournoi : un joueur refusé dans un tableau mais pris
    // ailleurs reçoit la « Bienvenue », pas la « Non-sélection ».
    const ran: Record<string, boolean> = {};
    for (const e of entries) { const ep = e.epreuve || "—"; if (e.confirmed) ran[ep] = true; }
    const confAny = new Set(entries.filter((e) => e.confirmed).map((e) => e.participant_id));
    return [...new Set(entries.filter((e) => !e.confirmed && ran[e.epreuve || "—"] && !confAny.has(e.participant_id)).map((e) => e.participant_id))];
  }
  if (key === "annulation") return [...new Set(entries.filter((e) => !epreuve || (e.epreuve || "—") === epreuve).map((e) => e.participant_id))];
  if (key === "remerciement") return [...new Set(entries.filter((e) => e.confirmed).map((e) => e.participant_id))].filter((pid) => !absent.has(pid));
  if (key === "vainqueur") return [...new Set(status.filter((s) => s.is_winner && s.photo_url).map((s) => s.participant_id))];
  return [];
}

// deno-lint-ignore no-explicit-any
async function sendForTournament(supa: any, tx: any, tId: string, key: string, origin: string, surveyId: string, limit: number, epreuve: string | null) {
  const { data: t } = await supa.from("gz_tournaments").select("id,name,registration_url,is_gamezone,swiss_id").eq("id", tId).maybeSingle();
  if (!t) return { sent: 0, remaining: 0 };
  // Le remerciement ne part que pour les tournois GameZone (les autres tableaux n'ont pas de suivi GameZone).
  if (key === "remerciement" && !t.is_gamezone) return { sent: 0, remaining: 0 };
  const { data: tpl } = await supa.from("gz_email_templates").select("*").eq("key", key).maybeSingle();
  if (!tpl) return { sent: 0, remaining: 0, error: "modele introuvable" };
  const [{ data: entries }, { data: status }, { data: mgrs }] = await Promise.all([
    supa.from("gz_entries").select("participant_id,confirmed,epreuve").eq("tournament_id", tId),
    supa.from("gz_player_status").select("participant_id,absent,is_winner,photo_url").eq("tournament_id", tId),
    supa.from("gz_managers").select("person_id").eq("tournament_id", tId),
  ]);
  let ids = recipientIds(key, entries || [], status || [], epreuve);
  const { data: sent } = await supa.from("gz_mail_sent").select("participant_id").eq("tournament_id", tId).eq("template_key", key);
  const done = new Set((sent || []).map((r: { participant_id: string }) => r.participant_id));
  ids = ids.filter((id) => !done.has(id));
  const total = ids.length;
  ids = ids.slice(0, limit);
  if (!ids.length) return { sent: 0, remaining: 0 };

  const { data: parts } = await supa.from("gz_participants").select("id,first_name,email").in("id", ids);
  const pById: Record<string, { first_name: string; email: string }> = {};
  for (const p of (parts || [])) pById[p.id] = p;
  const photoById: Record<string, string> = {};
  for (const s of (status || [])) if (s.photo_url) photoById[s.participant_id] = s.photo_url;
  let respo = "", respN = 0;
  if ((mgrs || []).length) {
    const { data: ppl } = await supa.from("people").select("first_name,last_name").in("id", (mgrs || []).map((m: { person_id: string }) => m.person_id));
    const rnames = (ppl || []).map((p: { first_name: string; last_name: string }) => `${p.first_name || ""} ${p.last_name || ""}`.trim()).filter(Boolean);
    respN = rnames.length;
    respo = rnames.join(", ");
  }
  const base: Record<string, string> = {
    tournoi: t.name || "", url_tournoi: tournoiUrl(t),
    code_vestiaire: CODE_VESTIAIRE, responsables: respo || "l'équipe Team Lausanne",
    resp_mot: respN > 1 ? "Responsables" : "Responsable",
    lien_tournois: GZ_LIST, lien_sondage: surveyId ? `${origin}/sondage.html?s=${surveyId}` : GZ_LIST,
  };
  let sentN = 0;
  for (const id of ids) {
    const p = pById[id];
    if (!p || !p.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) { await supa.from("gz_mail_sent").upsert({ tournament_id: tId, participant_id: id, template_key: key, email: p?.email || null }); continue; }
    const vars = { ...base, prenom: p.first_name || "" };
    const subject = fillVars(tpl.subject || "", vars);
    const bodyTxt = fillVars(tpl.body || "", vars);
    const imgUrl = key === "vainqueur" ? (photoById[id] || tpl.image_url) : tpl.image_url;
    const img = imgUrl ? `<div style="margin-top:14px"><img src="${imgUrl}" style="max-width:100%"/></div>` : "";
    const html = `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;color:#111">${toHtml(bodyTxt)}${img}</div>`;
    try {
      await tx.sendMail({ from: `\"Tournoi - Team Lausanne\" <${TOURNOI}>`, to: p.email, subject, text: bodyTxt, html });
      await supa.from("gz_mail_sent").upsert({ tournament_id: tId, participant_id: id, template_key: key, email: p.email });
      sentN++;
    } catch (_e) { /* on reessaiera au prochain passage */ }
  }
  return { sent: sentN, remaining: Math.max(0, total - sentN) };
}

async function activeGzSurvey(supa: unknown): Promise<string> {
  // deno-lint-ignore no-explicit-any
  const { data } = await (supa as any).from("gz_surveys").select("id").eq("active", true).is("tag", null).limit(1);
  return (data && data[0]) ? data[0].id : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const hub = (Deno.env.get("GMAIL_HUB") || "").trim();
    const hubPass = cleanPass(hub, Deno.env.get("GMAIL_APP_PASSWORD") || "");
    const tPass = cleanPass(TOURNOI, Deno.env.get("GMAIL_PASS_TOURNOI") || "");
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    const origin = (Deno.env.get("PUBLIC_ORIGIN") || "https://teamlausanne.netlify.app").replace(/\/$/, "");
    if (!hub || !hubPass) return json({ error: "secrets mail manquants" }, 400);
    const supa = createClient(url, service);

    const reqUrl = new URL(req.url);
    const key = reqUrl.searchParams.get("key") || "";
    const isCron = cronSecret && key === cronSecret;
    const payload = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    if (!isCron) {
      const authHeader = req.headers.get("Authorization") || "";
      const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
      const { data: ures } = await asUser.auth.getUser();
      const uid = ures?.user?.id;
      if (!uid) return json({ error: "non authentifie" }, 401);
      const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", uid);
      const ok = (roles || []).some((r: { role: string }) => ["superadmin", "admin", "secretaire", "organisateur"].includes(r.role));
      if (!ok) return json({ error: "reserve staff/official" }, 403);
    }

    const smtpUser = tPass ? TOURNOI : hub;
    const smtpPass = tPass || hubPass;
    const tx = nodemailer.createTransport({ host: smtpHost(smtpUser), port: 465, secure: true, auth: { user: smtpUser, pass: smtpPass } });
    const surveyId = await activeGzSurvey(supa);

    if (isCron || payload.cron) {
      const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const { data: ts } = await supa.from("gz_tournaments").select("id").eq("is_gamezone", true).gte("tournament_date", since).lt("tournament_date", today);
      let sent = 0;
      for (const t of (ts || [])) {
        for (const k of ["remerciement", "vainqueur"]) {
          const r = await sendForTournament(supa, tx, t.id, k, origin, surveyId, BATCH, null);
          sent += r.sent || 0;
        }
      }
      return json({ ok: true, sent });
    }

    const tId = String(payload.tournament_id || "");
    const k = String(payload.key || "");
    const epreuve = payload.epreuve ? String(payload.epreuve) : null;
    if (!tId || !k) return json({ error: "tournament_id et key requis" }, 400);
    const r = await sendForTournament(supa, tx, tId, k, origin, surveyId, BATCH, epreuve);
    return json({ ok: true, ...r });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
