// mail-import-box — importe les mails d'une boîte Gmail (IMAP) dans la console.
// Corps : { address, limit ≤ 100, offset = 0, all = false }.
//   all = false → INBOX, réception seulement (comportement historique, bouton « Importer autres boîtes »).
//   all = true  → dossier « Tous les messages » de Gmail : reçus ET envoyés (direction selon l'expéditeur),
//                 corps HTML et pièces jointes conservés ; pagination par offset du plus récent au plus ancien
//                 (bouton « Tout importer »). Retourne { inserted, scanned, total, remaining }.
// Une boîte PRIVÉE (mail_accounts.private_user_id) ne peut être importée que par son propriétaire
// ou un superadmin (v5, migration 60).
import { ImapFlow } from "npm:imapflow@1.0.164";
import { simpleParser } from "npm:mailparser@3.6.5";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const STAFF = ["superadmin", "admin", "secretaire"];
const PASS_ENV: Record<string, string> = {
  "tournoi@teamlausanne.ch": "GMAIL_PASS_TOURNOI",
  "info@lausanneopen.ch": "GMAIL_PASS_LAUSANNEOPEN",
  "admin@lstennis.ch": "GMAIL_PASS_LSTENNIS",
  "raphael@teamlausanne.ch": "GMAIL_PASSE_RAPHAEL",
};
const MAXB = 10 * 1024 * 1024;
const MAX_FETCH = 2 * 1024 * 1024;

function b64(u8: Uint8Array): string {
  let s = ""; const ch = 0x8000;
  for (let i = 0; i < u8.length; i += ch) s += String.fromCharCode(...u8.subarray(i, i + ch));
  return btoa(s);
}
// Pièces jointes : les images inline sont réinjectées dans le HTML, le reste devient une ligne mail_attachments.
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
async function isDup(supa: any, messageId: string | null, fromAddr: string | null, subj: string | null, dateIso: string) {
  if (messageId) { const { data } = await supa.from("mail_messages").select("id").eq("message_id", messageId).limit(1); if (data && data.length) return true; }
  if (fromAddr && subj) { const { data } = await supa.from("mail_messages").select("id").eq("from_address", fromAddr).eq("subject", subj).eq("received_at", dateIso).limit(1); if (data && data.length) return true; }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const hub = (Deno.env.get("GMAIL_HUB") || "").trim();
    const hubPass = (Deno.env.get("GMAIL_APP_PASSWORD") || "").replace(/\s+/g, "");

    const authHeader = req.headers.get("Authorization") || "";
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: ures } = await asUser.auth.getUser();
    const uid = ures?.user?.id;
    if (!uid) return json({ error: "non authentifie" }, 401);
    const supa = createClient(url, service);
    const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", uid);
    if (!(roles || []).some((r: { role: string }) => STAFF.includes(r.role))) return json({ error: "reserve au secretariat/admin" }, 403);
    const isSuper = (roles || []).some((r: { role: string }) => r.role === "superadmin");

    const body = await req.json().catch(() => ({}));
    const address = String(body.address || "").toLowerCase().trim();
    const limit = Math.min(100, Math.max(1, Number(body.limit) || 100));
    const offset = Math.max(0, Number(body.offset) || 0);
    const all = body.all === true;
    // Mode intégral : petits paquets, sinon la fonction dépasse la mémoire (WORKER_RESOURCE_LIMIT).
    const step = all ? Math.min(limit, 5) : limit;
    if (!address) return json({ error: "adresse manquante" }, 400);
    // Boîte privée : seul son propriétaire (ou un superadmin) peut l'importer.
    const { data: accRow } = await supa.from("mail_accounts").select("private_user_id").eq("address", address).maybeSingle();
    if (accRow?.private_user_id && accRow.private_user_id !== uid && !isSuper) return json({ error: "boite privee : reservee a son proprietaire" }, 403);
    const passName = address === hub.toLowerCase() ? null : PASS_ENV[address];
    const user = address;
    const pass = address === hub.toLowerCase() ? hubPass : (Deno.env.get(passName || "") || "").replace(/\s+/g, "");
    if (!pass) return json({ error: `Mot de passe d'app manquant pour ${address} (secret ${passName || "GMAIL_APP_PASSWORD"}).` }, 400);

    const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user, pass }, logger: false });
    await client.connect();
    // Dossier : INBOX, ou « Tous les messages » (special-use \All) en mode intégral.
    let box = "INBOX";
    if (all) {
      try { for (const b of await client.list()) { if ((b as { specialUse?: string }).specialUse === "\\All") { box = (b as { path: string }).path; break; } } } catch (_) {}
    }
    const lock = await client.getMailboxLock(box);
    let inserted = 0, scanned = 0, total = 0;
    try {
      // Pas de SEARCH sur toute la boîte (lourd sur « Tous les messages ») : on parcourt par numéros de séquence,
      // du plus récent (exists) vers le plus ancien, `step` messages par appel.
      total = Number((client.mailbox as { exists?: number })?.exists || 0);
      const seqs: number[] = [];
      for (let s = total - offset; s >= 1 && seqs.length < step; s--) seqs.push(s);
      console.log(`import-box ${address} box=${box} total=${total} offset=${offset} step=${step}`);
      for (const seq of seqs) {
        scanned++;
        const u = seq;
        // Mails géants : on ne charge pas le contenu (mémoire), on garde une trace allégée.
        const meta = await client.fetchOne(String(u), { envelope: true, size: true, uid: true });
        // deno-lint-ignore no-explicit-any
        const mm = meta as any;
        const realUid = mm?.uid || u;
        if ((mm?.size || 0) > MAX_FETCH) {
          const env = mm?.envelope || {};
          const fromE = (env.from && env.from[0]) || null;
          const dateE = (env.date ? new Date(env.date) : new Date()).toISOString();
          if (await isDup(supa, env.messageId || null, fromE?.address || null, env.subject || null, dateE)) continue;
          const { error: bigErr } = await supa.from("mail_messages").insert({
            account_address: address, direction: (all && fromE?.address && String(fromE.address).toLowerCase() === address) ? "out" : "in", message_id: env.messageId || null,
            from_name: fromE?.name || null, from_address: fromE?.address || null, to_address: address,
            subject: env.subject || null, snippet: `⚠ Mail volumineux (~${Math.round((mm.size || 0) / 1024 / 1024 * 10) / 10} Mo) — ouvrir dans Gmail`,
            body_text: "Ce message est trop volumineux pour etre affiche ici. Ouvre-le directement dans Gmail.", body_html: null,
            received_at: dateE, imap_uid: "box:" + address + ":" + (all ? "all:" : "") + realUid, is_read: true, status: "traite", pushed: true,
          });
          if (!bigErr) inserted++;
          continue;
        }
        const msg = await client.fetchOne(String(u), { source: true });
        if (!msg || !msg.source) continue;
        const p = await simpleParser(msg.source as Uint8Array);
        const messageId = p.messageId || null;
        const fromV = p.from?.value?.[0];
        const fromAddr = fromV?.address || null;
        const subj = p.subject || null;
        const dateIso = (p.date || new Date()).toISOString();
        if (await isDup(supa, messageId, fromAddr, subj, dateIso)) continue;
        const isOut = all && !!fromAddr && fromAddr.toLowerCase() === address;
        const body2 = (p.text || "").trim();
        const { html, rows } = all ? processAtt(p, p.html || null) : { html: null, rows: [] as Record<string, unknown>[] };
        const { data: ins, error: insErr } = await supa.from("mail_messages").insert({
          account_address: address, direction: isOut ? "out" : "in", message_id: messageId,
          from_name: fromV?.name || null, from_address: fromAddr, to_address: p.to?.value?.[0]?.address || address,
          subject: subj, snippet: body2.slice(0, 140), body_text: body2, body_html: html,
          received_at: dateIso, imap_uid: "box:" + address + ":" + (all ? "all:" : "") + realUid, is_read: true, status: "traite", pushed: true,
        }).select("id").single();
        if (insErr || !ins) continue;
        inserted++;
        if (rows.length) await supa.from("mail_attachments").insert(rows.map((r) => ({ ...r, mail_id: ins.id })));
      }
    } finally {
      lock.release();
      await client.logout();
    }
    return json({ ok: true, address, box, inserted, scanned, total, remaining: Math.max(0, total - (offset + scanned)) });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
