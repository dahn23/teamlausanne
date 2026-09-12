// mail-send — envoi d'un mail depuis une des boîtes de la console (Gmail SMTP).
// Secrets : GMAIL_HUB + GMAIL_APP_PASSWORD (boîte hub), puis un mot de passe d'application
// par boîte dans PASS_ENV. Une boîte PRIVÉE (mail_accounts.private_user_id) ne peut être
// utilisée que par son propriétaire ou un superadmin (v16, migration 60).
import nodemailer from "npm:nodemailer@6.9.14";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const STAFF = ["superadmin", "admin", "secretaire"];
const TOURNOI = "tournoi@teamlausanne.ch";
const PASS_ENV: Record<string, string> = {
  "tournoi@teamlausanne.ch": "GMAIL_PASS_TOURNOI",
  "info@lausanneopen.ch": "GMAIL_PASS_LAUSANNEOPEN",
  "admin@lstennis.ch": "GMAIL_PASS_LSTENNIS",
  "raphael@teamlausanne.ch": "GMAIL_PASSE_RAPHAEL",
};
const SEND_NAME: Record<string, string> = {
  "info@teamlausanne.ch": "Team Lausanne Academy",
  "tournoi@teamlausanne.ch": "Tournoi - Team Lausanne",
  "info@lausanneopen.ch": "Lausanne Open",
  "admin@lstennis.ch": "LS Tennis",
  "raphael@teamlausanne.ch": "Raphael Vergnaud - Team Lausanne",
};
const MAXB = 10 * 1024 * 1024;
const parseList = (v: unknown) => String(v || "").split(/[,;]/).map((x) => x.trim()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const hub = (Deno.env.get("GMAIL_HUB") || "").trim();
    const hubPass = (Deno.env.get("GMAIL_APP_PASSWORD") || "").replace(/\s+/g, "");
    if (!hub || !hubPass) return json({ error: "Secrets GMAIL_HUB / GMAIL_APP_PASSWORD manquants." }, 400);

    const authHeader = req.headers.get("Authorization") || "";
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: ures } = await asUser.auth.getUser();
    const uid = ures?.user?.id;
    if (!uid) return json({ error: "non authentifie" }, 401);
    const supa = createClient(url, service);
    const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", uid);
    const isStaff = (roles || []).some((r: { role: string }) => STAFF.includes(r.role));
    const isOfficial = (roles || []).some((r: { role: string }) => r.role === "organisateur");
    const isSuper = (roles || []).some((r: { role: string }) => r.role === "superadmin");

    const payload = await req.json();
    const { id, text, html } = payload;
    const ccList = parseList(payload.cc);
    const bccList = parseList(payload.bcc);
    // deno-lint-ignore no-explicit-any
    const atts: any[] = Array.isArray(payload.attachments) ? payload.attachments : [];
    const plain = (text && String(text).trim()) ? String(text) : String(html || "").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, "").trim();

    let account = "", toAddr = "", subject = "", inReplyTo: string | undefined, refs: string | undefined, replyId: string | null = null;
    if (id) {
      const { data: m } = await supa.from("mail_messages").select("*").eq("id", id).single();
      if (!m) return json({ error: "message introuvable" }, 404);
      if (!m.from_address) return json({ error: "pas d'adresse de reponse" }, 400);
      account = (m.account_address || "").toLowerCase();
      toAddr = m.from_address;
      subject = /^re:/i.test(m.subject || "") ? m.subject : "Re: " + (m.subject || "(sans objet)");
      inReplyTo = m.message_id || undefined; refs = m.message_id || undefined; replyId = m.id;
    } else {
      account = String(payload.account || "").toLowerCase().trim();
      toAddr = String(payload.to || "").trim();
      subject = String(payload.subject || "").trim() || "(sans objet)";
      const { data: acc } = await supa.from("mail_accounts").select("address").eq("address", account).limit(1);
      if (!acc || !acc.length) return json({ error: "compte d'envoi invalide" }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toAddr)) return json({ error: "adresse destinataire invalide" }, 400);
    }
    // Boîte privée : seul son propriétaire (ou un superadmin) peut envoyer depuis cette adresse.
    const { data: accRow } = await supa.from("mail_accounts").select("private_user_id").eq("address", account).maybeSingle();
    if (accRow?.private_user_id && accRow.private_user_id !== uid && !isSuper) return json({ error: "boite privee : reservee a son proprietaire" }, 403);
    // Autorisation : secretariat/admin partout ; official uniquement depuis tournoi@.
    if (!isStaff && !(isOfficial && account === TOURNOI)) return json({ error: "acces refuse (secretariat/admin, ou official pour tournoi@)" }, 403);
    if (!plain && !atts.length) return json({ error: "message vide" }, 400);

    let smtpUser = hub, smtpPass = hubPass;
    if (account && account !== hub.toLowerCase() && PASS_ENV[account]) {
      const bp = (Deno.env.get(PASS_ENV[account]) || "").replace(/\s+/g, "");
      if (bp) { smtpUser = account; smtpPass = bp; }
    }
    const displayName = SEND_NAME[smtpUser.toLowerCase()] || "";
    const fromHeader = displayName ? `"${displayName.replace(/"/g, "")}" <${smtpUser}>` : smtpUser;

    const transporter = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: smtpUser, pass: smtpPass } });
    // deno-lint-ignore no-explicit-any
    const nmAtts = atts.filter((a) => a && a.filename && a.content).map((a: any) => ({ filename: String(a.filename), content: String(a.content), encoding: "base64", contentType: a.contentType || undefined }));
    const info = await transporter.sendMail({
      from: fromHeader, to: toAddr,
      cc: ccList.length ? ccList : undefined, bcc: bccList.length ? bccList : undefined,
      subject, text: plain, html: html ? String(html) : undefined,
      attachments: nmAtts.length ? nmAtts : undefined, inReplyTo, references: refs,
    });

    const toStored = ccList.length ? `${toAddr}${toAddr ? ", " : ""}${ccList.join(", ")}` : toAddr;
    const { data: outIns } = await supa.from("mail_messages").insert({
      account_address: account, direction: "out", message_id: info?.messageId || null,
      from_name: displayName || null, from_address: smtpUser, to_address: toStored,
      subject, snippet: plain.slice(0, 140), body_text: plain, body_html: html ? String(html) : null,
      received_at: new Date().toISOString(), is_read: true, status: "traite", pushed: true,
    }).select("id").single();
    if (outIns && nmAtts.length) {
      const rows = nmAtts.map((a) => {
        const b64 = String(a.content);
        const size = Math.floor((b64.length * 3) / 4);
        return { mail_id: outIns.id, filename: a.filename, content_type: a.contentType || null, size_bytes: size, content_id: null, is_inline: false, content_b64: size > MAXB ? null : b64 };
      });
      await supa.from("mail_attachments").insert(rows);
    }
    if (replyId) {
      const nowIso = new Date().toISOString();
      await supa.from("mail_messages").update({ status: "traite", is_read: true, replied: true, replied_at: nowIso }).eq("id", replyId);
      const { data: prof } = await supa.from("profiles").select("person_id").eq("user_id", uid).maybeSingle();
      if (prof?.person_id) {
        await supa.from("mail_messages").update({ treated_by: prof.person_id, treated_at: nowIso }).eq("id", replyId).is("treated_by", null);
      }
    }

    return json({ ok: true, from: smtpUser, name: displayName });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
