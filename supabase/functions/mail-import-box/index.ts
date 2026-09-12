// mail-import-box — importe les N derniers mails de la boîte de réception d'une boîte
// (IMAP Gmail) dans la console. Une boîte PRIVÉE (mail_accounts.private_user_id) ne peut
// être importée que par son propriétaire ou un superadmin (v4, migration 60).
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
  "raphael@teamlausanne.ch": "GMAIL_PASS_RAPHAEL",
};

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
    const limit = Math.min(300, Math.max(1, Number(body.limit) || 100));
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
    const lock = await client.getMailboxLock("INBOX");
    let inserted = 0, scanned = 0;
    try {
      let uids = (await client.search({ all: true }, { uid: true })) || [];
      uids = uids.sort((a: number, b: number) => b - a).slice(0, limit);
      for (const u of uids) {
        scanned++;
        const msg = await client.fetchOne(u, { source: true }, { uid: true });
        if (!msg || !msg.source) continue;
        const p = await simpleParser(msg.source as Uint8Array);
        const messageId = p.messageId || null;
        const fromV = p.from?.value?.[0];
        const fromAddr = fromV?.address || null;
        const subj = p.subject || null;
        const dateIso = (p.date || new Date()).toISOString();
        if (await isDup(supa, messageId, fromAddr, subj, dateIso)) continue;
        const body2 = (p.text || "").trim();
        const { error: insErr } = await supa.from("mail_messages").insert({
          account_address: address, direction: "in", message_id: messageId,
          from_name: fromV?.name || null, from_address: fromAddr, to_address: p.to?.value?.[0]?.address || address,
          subject: subj, snippet: body2.slice(0, 140), body_text: body2,
          received_at: dateIso, imap_uid: "box:" + address + ":" + u, is_read: true, status: "traite",
        });
        if (!insErr) inserted++;
      }
    } finally {
      lock.release();
      await client.logout();
    }
    return json({ ok: true, address, inserted, scanned });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
