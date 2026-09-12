// mail-cron — relève la boîte hub Gmail (IMAP), range chaque mail dans la bonne boîte
// (en-têtes Delivered-To / X-Forwarded-For contenant une adresse de mail_accounts),
// détecte les factures PDF, relit les Envoyés, puis pousse les notifications.
// v23 (migration 60) : une boîte PRIVÉE (mail_accounts.private_user_id) n'est notifiée
// qu'à son propriétaire et aux superadmins.
import { ImapFlow } from "npm:imapflow@1.0.164";
import { simpleParser } from "npm:mailparser@3.6.5";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
const IN_MAX = 12;
const SENT_WINDOW = 25;
const SENT_MAX = 6;
const MAXB = 10 * 1024 * 1024;
const MAX_FETCH = 8 * 1024 * 1024;
const ORIGIN = "https://app.teamlausanne.ch";
const PUSH_ICON = ORIGIN + "/assets/pwa/admin-icon-192.png";
const PUSH_BADGE = ORIGIN + "/assets/pwa/admin-badge.png?v=5";
const INV_RE = /facture|invoice|rechnung|fattura|qr.?rechnung|quittung/;
const mb = (b: number) => Math.round(b / 1024 / 1024 * 10) / 10;

function b64(u8: Uint8Array): string {
  let s = ""; const ch = 0x8000;
  for (let i = 0; i < u8.length; i += ch) s += String.fromCharCode(...u8.subarray(i, i + ch));
  return btoa(s);
}
// deno-lint-ignore no-explicit-any
function processAtt(p: any, htmlIn: string | null) {
  let html = htmlIn;
  const rows: Record<string, unknown>[] = [];
  for (const a of (p.attachments || [])) {
    try {
      const u8: Uint8Array = a.content instanceof Uint8Array ? a.content : new Uint8Array(a.content || []);
      const cid = String(a.cid || a.contentId || "").replace(/[<>]/g, "");
      const tooBig = u8.length > MAXB;
      const isInline = (a.contentDisposition === "inline") || (!!cid && !!html && html.includes("cid:" + cid));
      if (isInline && cid && html && !tooBig) {
        html = html.split("cid:" + cid).join(`data:${a.contentType || "image/png"};base64,${b64(u8)}`);
        continue;
      }
      rows.push({ filename: a.filename || "fichier", content_type: a.contentType || null, size_bytes: u8.length, content_id: cid || null, is_inline: false, content_b64: tooBig ? null : b64(u8) });
    } catch (_) {}
  }
  return { html, rows };
}

// deno-lint-ignore no-explicit-any
async function isDupMsg(supa: any, messageId: string | null, fromAddr: string | null, subj: string | null, dateIso: string) {
  if (messageId) { const { data } = await supa.from("mail_messages").select("id").eq("message_id", messageId).limit(1); if (data && data.length) return true; }
  if (fromAddr && subj) { const { data } = await supa.from("mail_messages").select("id").eq("from_address", fromAddr).eq("subject", subj).eq("received_at", dateIso).limit(1); if (data && data.length) return true; }
  return false;
}

// deno-lint-ignore no-explicit-any
async function maybeInvoice(supa: any, mailId: string, subj: string, body: string, fromLabel: string, rows: any[]) {
  const pdfRow = rows.find((r) => String(r.content_type || "").includes("pdf") || /\.pdf$/i.test(String(r.filename || "")));
  if (!pdfRow || !pdfRow.content_b64) return;
  const hay = `${subj || ""} ${body || ""} ${pdfRow.filename || ""}`.toLowerCase();
  if (!INV_RE.test(hay)) return;
  const { data: ex } = await supa.from("invoices").select("id").eq("mail_id", mailId).limit(1);
  if (ex && ex.length) return;
  const bytes = Uint8Array.from(atob(pdfRow.content_b64), (ch: string) => ch.charCodeAt(0));
  const path = crypto.randomUUID() + ".pdf";
  const up = await supa.storage.from("invoices").upload(path, bytes, { contentType: "application/pdf" });
  if (up.error) return;
  await supa.from("invoices").insert({ source: "mail", mail_id: mailId, pdf_path: path, filename: pdfRow.filename,
    explanation: `Recu par mail de ${fromLabel} — ${subj || "(sans objet)"}`, status: "a_valider" });
  await supa.from("mail_messages").update({ has_invoice: true }).eq("id", mailId);
}

// deno-lint-ignore no-explicit-any
async function sendPush(supa: any) {
  const cutoff = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  const { data: mails } = await supa.from("mail_messages")
    .select("id,from_name,from_address,subject,account_address").eq("direction", "in").eq("pushed", false)
    .gte("received_at", cutoff).order("received_at", { ascending: false }).limit(20);
  if (!mails || !mails.length) return { found: 0, sent: 0 };
  const ids = mails.map((m: { id: string }) => m.id);
  await supa.from("mail_messages").update({ pushed: true }).in("id", ids);
  const { data: cfg } = await supa.from("push_config").select("*").eq("id", 1).maybeSingle();
  const { data: subs } = await supa.from("push_subscriptions").select("*");
  if (!cfg) return { found: mails.length, sent: 0, error: "pas de push_config" };
  if (!subs || !subs.length) return { found: mails.length, sent: 0, error: "aucun abonnement" };
  const { data: accs } = await supa.from("mail_accounts").select("address,label,private_user_id");
  const accLabel: Record<string, string> = {}; const accOwner: Record<string, string | null> = {};
  (accs || []).forEach((a: { address: string; label?: string; private_user_id?: string | null }) => { accLabel[a.address] = a.label || a.address; accOwner[a.address] = a.private_user_id || null; });
  const { data: staffRoles } = await supa.from("user_roles").select("user_id,role").in("role", ["superadmin", "admin", "secretaire"]);
  const staffIds = new Set((staffRoles || []).map((r: { user_id: string }) => r.user_id));
  const superIds = new Set((staffRoles || []).filter((r: { role: string }) => r.role === "superadmin").map((r: { user_id: string }) => r.user_id));
  webpush.setVapidDetails(cfg.subject, cfg.public_key, cfg.private_key);
  const nm = (m: { from_name?: string; from_address?: string }) => m.from_name || m.from_address || "?";
  const boxOf = (m: { account_address?: string }) => accLabel[m.account_address || ""] || m.account_address || "";
  // deno-lint-ignore no-explicit-any
  const payloadFor = (list: any[]) => {
    const n = list.length;
    const title = n === 1 ? `Nouveau mail — ${boxOf(list[0])}` : `${n} nouveaux mails`;
    const body = n === 1 ? `${nm(list[0])} : ${list[0].subject || "(sans objet)"}`
      : list.slice(0, 3).map((m: any) => `${boxOf(m)} • ${nm(m)} : ${m.subject || "(sans objet)"}`).join("\n");
    return JSON.stringify({ title, body, url: "/console", tag: "mail", icon: PUSH_ICON, badge: PUSH_BADGE });
  };
  let sent = 0; let error: string | null = null; let targets = 0;
  for (const s of subs) {
    if (!staffIds.has(s.user_id)) continue;
    // Boîte privée : seulement son propriétaire et les superadmins reçoivent la notification.
    // deno-lint-ignore no-explicit-any
    const visible = mails.filter((m: any) => { const o = accOwner[m.account_address || ""]; return !o || o === s.user_id || superIds.has(s.user_id); });
    if (!visible.length) continue;
    targets++;
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payloadFor(visible), { urgency: "high", TTL: 86400 });
      sent++;
    } catch (err) {
      const c = (err as { statusCode?: number })?.statusCode;
      if (c === 404 || c === 410) await supa.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      if (!error) error = `sc=${c || "?"} ${String((err as { body?: string; message?: string })?.body || (err as Error)?.message || err).slice(0, 250)}`;
    }
  }
  return { found: mails.length, sent, targets, error };
}

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get("CRON_SECRET") || "";
    const key = new URL(req.url).searchParams.get("key") || req.headers.get("x-cron-secret") || "";
    if (!secret || key !== secret) return json({ error: "forbidden" }, 403);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const hub = (Deno.env.get("GMAIL_HUB") || "").trim();
    const pass = (Deno.env.get("GMAIL_APP_PASSWORD") || "").replace(/\s+/g, "");
    if (!hub || !pass) return json({ error: "secrets manquants" }, 400);
    const supa = createClient(url, service);
    const { data: accts } = await supa.from("mail_accounts").select("address");
    const hubLower = hub.toLowerCase();
    const ourAddrs = (accts || []).map((a: { address: string }) => a.address.toLowerCase());

    const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user: hub, pass }, logger: false });
    await client.connect();
    let archiveBox: string | null = null, sentBox: string | null = null;
    try { for (const b of await client.list()) { const su = (b as { specialUse?: string }).specialUse; if (su === "\\All") archiveBox = (b as { path: string }).path; if (su === "\\Sent") sentBox = (b as { path: string }).path; } } catch (_) {}

    let inserted = 0, archived = 0, sent = 0, skippedBig = 0, backfilled = 0;
    const lock = await client.getMailboxLock("INBOX");
    try {
      let uids = (await client.search({ all: true }, { uid: true })) || [];
      uids = uids.sort((a: number, b: number) => b - a).slice(0, IN_MAX);
      for (const u of uids) {
        const meta = await client.fetchOne(u, { envelope: true, size: true }, { uid: true });
        // deno-lint-ignore no-explicit-any
        const mm = meta as any;
        const size = mm?.size || 0;
        const env = mm?.envelope || {};
        const messageId = env.messageId || null;
        const fromV = (env.from && env.from[0]) || null;
        const fromAddr = fromV?.address || null;
        const subj = env.subject || null;
        const dateIso = (env.date ? new Date(env.date) : new Date()).toISOString();
        if (!(await isDupMsg(supa, messageId, fromAddr, subj, dateIso))) {
          if (size > MAX_FETCH) {
            await supa.from("mail_messages").insert({ account_address: hubLower, direction: "in", message_id: messageId, from_name: fromV?.name || null, from_address: fromAddr, to_address: hubLower, subject: subj, snippet: `⚠ Mail volumineux (~${mb(size)} Mo) — ouvrir dans Gmail`, body_text: `Ce message est trop volumineux (~${mb(size)} Mo) pour etre affiche ici. Ouvre-le directement dans Gmail.`, body_html: null, received_at: dateIso, imap_uid: String(u), is_read: false, status: "a_traiter", pushed: false });
            inserted++; skippedBig++;
          } else {
            const msg = await client.fetchOne(u, { source: true }, { uid: true });
            if (msg && (msg as { source?: Uint8Array }).source) {
              const p = await simpleParser((msg as { source: Uint8Array }).source);
              const mId = p.messageId || messageId;
              const fV = p.from?.value?.[0];
              const fA = fV?.address || fromAddr;
              const sj = p.subject || subj;
              const dI = (p.date || new Date()).toISOString();
              const pathAddrs = new Set<string>();
              for (const h of (p.headerLines || [])) { if (h.key === "delivered-to" || h.key === "x-forwarded-to" || h.key === "x-forwarded-for") { for (const a of (h.line.match(/[\w.+-]+@[\w.-]+\.[\w-]+/g) || [])) pathAddrs.add(a.toLowerCase()); } }
              let brand: string | null = null;
              for (const a of ourAddrs) if (a !== hubLower && pathAddrs.has(a)) { brand = a; break; }
              if (!brand) brand = hubLower;
              const body = (p.text || "").trim();
              const { html, rows } = processAtt(p, p.html || null);
              const { data: ins, error: e } = await supa.from("mail_messages").insert({ account_address: brand, direction: "in", message_id: mId, from_name: fV?.name || null, from_address: fA, to_address: p.to?.value?.[0]?.address || brand, subject: sj, snippet: body.slice(0, 140), body_text: body, body_html: html, received_at: dI, imap_uid: String(u), is_read: false, status: "a_traiter", pushed: false }).select("id").single();
              if (!e && ins) {
                inserted++;
                if (rows.length) await supa.from("mail_attachments").insert(rows.map((r) => ({ ...r, mail_id: ins.id })));
                try { await maybeInvoice(supa, ins.id, sj || "", body, fV?.name || fA || "?", rows); } catch (_) {}
              }
            }
          }
        }
        try { await client.messageFlagsAdd(u, ["\\Seen"], { uid: true }); if (archiveBox) { await client.messageMove(u, archiveBox, { uid: true }); archived++; } } catch (_) {}
      }
    } finally { lock.release(); }

    let push: unknown = { found: 0, sent: 0 };
    try { push = await sendPush(supa); } catch (e) { push = { error: String((e as Error)?.message || e) }; }

    if (sentBox) {
      const lock2 = await client.getMailboxLock(sentBox);
      try {
        let suids = (await client.search({ all: true }, { uid: true })) || [];
        suids = suids.sort((a: number, b: number) => b - a).slice(0, SENT_WINDOW);
        const tags = suids.map((su: number) => "sent:" + su);
        const { data: existing } = tags.length ? await supa.from("mail_messages").select("imap_uid").in("imap_uid", tags) : { data: [] };
        const have = new Set((existing || []).map((r: { imap_uid: string }) => r.imap_uid));
        let work = 0;
        for (const su of suids) {
          if (work >= SENT_MAX) break;
          const tag = "sent:" + su;
          if (have.has(tag)) continue;
          work++;
          const metaS = await client.fetchOne(su, { envelope: true, size: true }, { uid: true });
          // deno-lint-ignore no-explicit-any
          if (((metaS as any)?.size || 0) > MAX_FETCH) continue;
          const msg = await client.fetchOne(su, { source: true }, { uid: true });
          if (!msg || !(msg as { source?: Uint8Array }).source) continue;
          const p = await simpleParser((msg as { source: Uint8Array }).source);
          const messageId = p.messageId || null;
          const fromV = p.from?.value?.[0];
          const fromAddr = fromV?.address || null;
          const toAddr = p.to?.value?.[0]?.address || null;
          const subj = p.subject || null;
          const dateIso = (p.date || new Date()).toISOString();
          if (await isDupMsg(supa, messageId, fromAddr, subj, dateIso)) {
            const { data: exist } = await supa.from("mail_messages").select("id").eq("message_id", messageId).eq("direction", "out").limit(1);
            const existId = exist && exist[0] && (exist[0] as { id: string }).id;
            if (existId) {
              await supa.from("mail_messages").update({ imap_uid: tag }).eq("id", existId).is("imap_uid", null);
              const { rows } = processAtt(p, p.html || null);
              if (rows.length) {
                const { count } = await supa.from("mail_attachments").select("id", { count: "exact", head: true }).eq("mail_id", existId);
                if (!count) { await supa.from("mail_attachments").insert(rows.map((r) => ({ ...r, mail_id: existId }))); backfilled++; }
              }
            }
            continue;
          }
          const brand = (fromAddr && ourAddrs.includes(fromAddr.toLowerCase())) ? fromAddr.toLowerCase() : hubLower;
          const body = (p.text || "").trim();
          const { html, rows } = processAtt(p, p.html || null);
          const { data: ins, error: e } = await supa.from("mail_messages").insert({ account_address: brand, direction: "out", message_id: messageId, from_name: fromV?.name || null, from_address: fromAddr, to_address: toAddr, subject: subj, snippet: body.slice(0, 140), body_text: body, body_html: html, received_at: dateIso, imap_uid: tag, is_read: true, status: "traite", pushed: true }).select("id").single();
          if (!e && ins) { sent++; if (rows.length) await supa.from("mail_attachments").insert(rows.map((r) => ({ ...r, mail_id: ins.id }))); }
        }
      } finally { lock2.release(); }
    }

    await client.logout();
    return json({ ok: true, inserted, archived, sent, skippedBig, backfilled, push });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
