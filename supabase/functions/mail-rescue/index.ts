// mail-rescue — rattrapage PONCTUEL des mails restés dans Gmail (info@teamlausanne.ch) pendant la
// semaine où la console ne relevait plus (verrouillage du compte Google du 12.09.2026, puis bascule
// des boîtes chez Hostpoint le 18.09.2026). Lit « Tous les messages » et « Envoyés » de Gmail sur une
// fenêtre de dates, insère ce qui manque (dédoublonnage comme mail-cron), SANS notification.
// Ne touche pas aux mails côté Gmail (ni lu, ni archivé). Réexécutable sans risque.
//
// Appel : POST ?key=<CRON_SECRET>  body { since: "2026-09-11", until: "2026-09-19", dry: true|false, max: 300 }
// Secrets : GMAIL_RESCUE_USER (adresse Gmail, défaut info@teamlausanne.ch), GMAIL_RESCUE_PASS (mot de passe
// d'application Gmail, créé par Dan dans Sécurité → Validation en deux étapes → Mots de passe d'application).
import { ImapFlow } from "npm:imapflow@1.0.164";
import { simpleParser } from "npm:mailparser@3.6.5";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
const MAX_FETCH = 8 * 1024 * 1024;
const MAXB = 10 * 1024 * 1024;

function b64(u8: Uint8Array): string {
  let s = ""; const ch = 0x8000;
  for (let i = 0; i < u8.length; i += ch) s += String.fromCharCode(...u8.subarray(i, i + ch));
  return btoa(s);
}
// deno-lint-ignore no-explicit-any
function processAtt(p: any, htmlIn: string | null, attMax = MAXB) {
  let html = htmlIn;
  const rows: Record<string, unknown>[] = [];
  for (const a of (p.attachments || [])) {
    try {
      const u8: Uint8Array = a.content instanceof Uint8Array ? a.content : new Uint8Array(a.content || []);
      const cid = String(a.cid || a.contentId || "").replace(/[<>]/g, "");
      const tooBig = u8.length > attMax;
      const isInline = (a.contentDisposition === "inline") || (!!cid && !!html && html.includes("cid:" + cid));
      if (isInline && cid && html && !tooBig) { html = html.split("cid:" + cid).join(`data:${a.contentType || "image/png"};base64,${b64(u8)}`); continue; }
      rows.push({ filename: a.filename || "fichier", content_type: a.contentType || null, size_bytes: u8.length, content_id: cid || null, is_inline: false, content_b64: tooBig ? null : b64(u8) });
    } catch (_) { /* pièce illisible : on passe */ }
  }
  return { html, rows };
}
// deno-lint-ignore no-explicit-any
async function isDupMsg(supa: any, messageId: string | null, fromAddr: string | null, subj: string | null, dateIso: string) {
  if (messageId) { const { data } = await supa.from("mail_messages").select("id").eq("message_id", messageId).limit(1); if (data && data.length) return true; }
  if (fromAddr && subj) { const { data } = await supa.from("mail_messages").select("id").eq("from_address", fromAddr).eq("subject", subj).eq("received_at", dateIso).limit(1); if (data && data.length) return true; }
  return false;
}
// Destinataires en copie, en texte : « Nom <adresse>, … » (migration 96).
// deno-lint-ignore no-explicit-any
const ccOf = (p: any): string | null => {
  const list = (p.cc?.value || []) as { name?: string; address?: string }[];
  const s = list.filter((v) => v.address).map((v) => (v.name ? `${v.name} <${v.address}>` : String(v.address))).join(", ");
  return s ? s.slice(0, 2000) : null;
};
const isDmarcReport = (subject: string | null, from: string | null) =>
  /^\s*(\[[^\]]*\]\s*)?report domain:/i.test(subject || "") || /(^|[._-])dmarc[^@]*@/i.test(from || "");

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get("CRON_SECRET") || "";
    const key = new URL(req.url).searchParams.get("key") || req.headers.get("x-cron-secret") || "";
    if (!secret || key !== secret) return json({ error: "forbidden" }, 403);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const since = String(body.since || "2026-09-11");
    const until = String(body.until || "2026-09-19");
    const dry = body.dry !== false;                       // par défaut on ne fait que compter
    const treated = body.treated === true;                // archive ancienne : tout entre lu et « traité »
    const max = Math.min(Number(body.max) || 300, dry ? 5000 : 600);   // compter est léger (enveloppes seules)
    // Mode « léger » pour les archives : au-delà de maxBytes, le mail entre comme fiche sans contenu (comme mail-cron
    // pour les mails volumineux) ; au-delà de attMax, la pièce jointe est listée sans son contenu. Évite de faire
    // sauter la mémoire du serveur sur un mail à 8 Mo de photos.
    const maxFetch = Math.max(200 * 1024, Math.min(Number(body.maxBytes) || MAX_FETCH, MAX_FETCH));
    const attMax = Math.max(50 * 1024, Math.min(Number(body.attMax) || MAXB, MAXB));

    const user = (Deno.env.get("GMAIL_RESCUE_USER") || "info@teamlausanne.ch").trim().toLowerCase();
    const pass = String(Deno.env.get("GMAIL_RESCUE_PASS") || "").replace(/\s+/g, "");
    if (!pass) return json({ error: "secret GMAIL_RESCUE_PASS manquant" }, 400);
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: accts } = await supa.from("mail_accounts").select("address");
    const ourAddrs = (accts || []).map((a: { address: string }) => a.address.toLowerCase());

    const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user, pass }, logger: false });
    await client.connect();
    const st = { examined: 0, missing: 0, inserted: 0, sentExamined: 0, sentMissing: 0, sentInserted: 0, skippedBig: 0 };
    const sample: string[] = [];
    try {
      const boxes = await client.list();
      let allBox: string | null = null, sentBox: string | null = null;
      for (const b of boxes) { const su = (b as { specialUse?: string }).specialUse; if (su === "\\All") allBox = (b as { path: string }).path; if (su === "\\Sent") sentBox = (b as { path: string }).path; }
      const folders = [{ path: allBox || "INBOX", dir: "in" as const }, ...(sentBox ? [{ path: sentBox, dir: "out" as const }] : [])];
      for (const f of folders) {
        const lock = await client.getMailboxLock(f.path);
        try {
          let uids = (await client.search({ since: new Date(since + "T00:00:00Z"), before: new Date(until + "T00:00:00Z") }, { uid: true })) || [];
          uids = uids.sort((a: number, b: number) => a - b).slice(0, max);
          for (const u of uids) {
            if (f.dir === "in") st.examined++; else st.sentExamined++;
            const meta = await client.fetchOne(u, { envelope: true, size: true }, { uid: true });
            // deno-lint-ignore no-explicit-any
            const mm = meta as any;
            const env = mm?.envelope || {};
            const messageId = env.messageId || null;
            const fromV = (env.from && env.from[0]) || null;
            const fromAddr = (fromV?.address || "").toLowerCase() || null;
            const subj = env.subject || null;
            const dateIso = (env.date ? new Date(env.date) : new Date()).toISOString();
            // « Tous les messages » contient aussi nos propres envois : ils relèvent du dossier Envoyés.
            if (f.dir === "in" && fromAddr && ourAddrs.includes(fromAddr)) continue;
            if (await isDupMsg(supa, messageId, fromAddr, subj, dateIso)) continue;
            if (f.dir === "in") st.missing++; else st.sentMissing++;
            if (sample.length < 40) sample.push(`${f.dir} ${dateIso.slice(0, 10)} ${fromAddr || "?"} — ${subj || "(sans objet)"}`);
            if (dry) continue;
            if ((mm?.size || 0) > maxFetch) {
              // Trop gros pour être lu ici : on garde la trace (expéditeur, sujet, date) sans le contenu.
              const mo = Math.round((mm.size || 0) / 1024 / 1024 * 10) / 10;
              const stub = { account_address: user, direction: f.dir, message_id: messageId, from_name: fromV?.name || null, from_address: fromAddr, to_address: f.dir === "in" ? user : null, subject: subj,
                snippet: `⚠ Mail volumineux (~${mo} Mo) — non importé, voir l'archive Gmail`, body_text: `Ce message (~${mo} Mo) n'a pas été importé dans la console : il reste consultable dans l'archive Gmail de ${user}.`, body_html: null,
                received_at: dateIso, imap_uid: f.dir === "in" ? `rescue:${u}` : `rescue-sent:${u}`, is_read: true, status: "traite", pushed: true, pushed_native: true };
              const { error: e0 } = await supa.from("mail_messages").insert(stub);
              if (!e0) { st.skippedBig++; if (f.dir === "in") st.inserted++; else st.sentInserted++; }
              continue;
            }
            const msg = await client.fetchOne(u, { source: true }, { uid: true });
            if (!msg || !(msg as { source?: Uint8Array }).source) continue;
            const p = await simpleParser((msg as { source: Uint8Array }).source);
            const mId = p.messageId || messageId;
            const fV = p.from?.value?.[0];
            const fA = (fV?.address || fromAddr || "").toLowerCase() || null;
            const sj = p.subject || subj;
            const dI = (p.date || new Date()).toISOString();
            const bodyTxt = (p.text || "").trim();
            const { html, rows } = processAtt(p, p.html || null, attMax);
            const cc = ccOf(p);
            let brand = user;
            if (f.dir === "in") {
              // Le hub recevait les redirections des autres boîtes : l'en-tête dit à qui le mail était destiné.
              const pathAddrs = new Set<string>();
              for (const h of (p.headerLines || [])) { if (h.key === "delivered-to" || h.key === "x-forwarded-to" || h.key === "x-forwarded-for") { for (const a of (h.line.match(/[\w.+-]+@[\w.-]+\.[\w-]+/g) || [])) pathAddrs.add(a.toLowerCase()); } }
              for (const a of ourAddrs) if (a !== user && pathAddrs.has(a)) { brand = a; break; }
            } else if (fA && ourAddrs.includes(fA)) brand = fA;
            const dm = f.dir === "in" && isDmarcReport(sj, fA);
            const row = f.dir === "in"
              ? { account_address: brand, direction: "in", message_id: mId, from_name: fV?.name || null, from_address: fA, to_address: p.to?.value?.[0]?.address || brand, cc_address: cc, subject: sj, snippet: bodyTxt.slice(0, 140), body_text: bodyTxt, body_html: html, received_at: dI, imap_uid: `rescue:${u}`, is_read: dm || treated, status: (dm || treated) ? "traite" : "a_traiter", pushed: true, pushed_native: true }
              : { account_address: brand, direction: "out", message_id: mId, from_name: fV?.name || null, from_address: fA, to_address: p.to?.value?.[0]?.address || null, cc_address: cc, subject: sj, snippet: bodyTxt.slice(0, 140), body_text: bodyTxt, body_html: html, received_at: dI, imap_uid: `rescue-sent:${u}`, is_read: true, status: "traite", pushed: true, pushed_native: true };
            const { data: ins, error: e } = await supa.from("mail_messages").insert(row).select("id").single();
            if (e || !ins) continue;
            if (f.dir === "in") st.inserted++; else st.sentInserted++;
            if (rows.length) await supa.from("mail_attachments").insert(rows.map((r) => ({ ...r, mail_id: ins.id })));
          }
        } finally { lock.release(); }
      }
    } finally { try { await client.logout(); } catch (_) { /* déjà fermé */ } }
    return json({ ok: true, dry, since, until, ...st, sample });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
