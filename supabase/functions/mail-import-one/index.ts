// mail-import-one — importe EN ENTIER, à la demande, un mail que la relève automatique n'a pas pu décoder
// (« ⚠ Mail volumineux » > 8 Mo, ou « ⚠ Mail trop lourd » : décodage trop long, voir mail-cron v42).
// v1 (13.10.2026, Dan : « forcer l'importation au cas par cas plutôt que d'ouvrir le webmail »).
//
// Pourquoi ça passe ici alors que mail-cron échoue : mail-cron décode le message d'un bloc (mailparser) puis
// recode chaque pièce jointe en base64 pour la base — très gourmand en calcul. Ici on lit la STRUCTURE du mail,
// on télécharge chaque partie séparément (le serveur IMAP l'envoie déjà découpée), le texte va dans la fiche
// et chaque pièce jointe part TELLE QUELLE dans le bucket privé « mail-att » (storage_path), sans base64.
//
// Appel : POST { mail_id } avec le jeton de l'utilisateur (superadmin, admin, secrétaire ; boîte privée :
// son propriétaire ou un superadmin). Seuls les mails relevés chez Hostpoint (imap_uid « hp: » ou « hpspam: »)
// peuvent être relus ; les anciens imports Gmail (« box: ») ne sont plus accessibles par ce chemin.
import { ImapFlow } from "npm:imapflow@1.0.164";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, apikey, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const MAX_PART = 50 * 1024 * 1024;   // une pièce jointe de plus de 50 Mo reste dans le webmail
// Mot de passe de chaque boîte Hostpoint (mêmes secrets que mail-cron).
const PASS_ENV: Record<string, string> = {
  "tournoi@teamlausanne.ch": "GMAIL_PASS_TOURNOI",
  "raphael@teamlausanne.ch": "GMAIL_PASSE_RAPHAEL",
  "info@lausanneopen.ch": "GMAIL_PASS_LAUSANNEOPEN",
};
const strip = (h: string) => h.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\n{3,}/g, "\n\n").trim();

// deno-lint-ignore no-explicit-any
type Node = any;
function leaves(n: Node, out: Node[] = []): Node[] {
  if (n?.childNodes?.length) for (const c of n.childNodes) leaves(c, out);
  else if (n) out.push(n);
  return out;
}
// deno-lint-ignore no-explicit-any
async function readAll(stream: any, limit: number): Promise<Uint8Array | null> {
  const chunks: Uint8Array[] = []; let n = 0;
  for await (const c of stream) { const u = c instanceof Uint8Array ? c : new Uint8Array(c); n += u.length; if (n > limit) return null; chunks.push(u); }
  const out = new Uint8Array(n); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supa = createClient(url, service);
    // Qui demande ? Un utilisateur connecté, ou un appel technique avec ?key=CRON_SECRET (droits superadmin).
    const secret = Deno.env.get("CRON_SECRET") || "";
    const tech = !!secret && new URL(req.url).searchParams.get("key") === secret;
    let uid: string | null = null, rs: string[] = ["superadmin"];
    if (!tech) {
      const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
      uid = (await asUser.auth.getUser()).data?.user?.id || null;
      if (!uid) return json({ error: "non authentifié" }, 401);
      const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", uid);
      rs = (roles || []).map((r: { role: string }) => r.role);
    }
    if (!rs.some((r: string) => ["superadmin", "admin", "secretaire"].includes(r))) return json({ error: "réservé au secrétariat et à la direction" }, 403);

    const { mail_id } = await req.json().catch(() => ({}));
    if (!mail_id) return json({ error: "mail_id requis" }, 400);
    const { data: m } = await supa.from("mail_messages").select("id,account_address,imap_uid,direction").eq("id", mail_id).maybeSingle();
    if (!m) return json({ error: "mail introuvable" }, 404);
    const { data: acc } = await supa.from("mail_accounts").select("private_user_id").eq("address", m.account_address).maybeSingle();
    if (acc?.private_user_id && acc.private_user_id !== uid && !rs.includes("superadmin")) return json({ error: "boîte privée" }, 403);

    // imap_uid : « hp:<boîte>:<uid> » (réception) ou « hpspam:<boîte>:<uid> » (dossier Spam).
    const mt = String(m.imap_uid || "").match(/^(hp|hpspam):([^:]+@[^:]+):(\d+)$/);
    if (!mt) return json({ error: "Ce mail n'est plus accessible chez Hostpoint (ancien import Gmail) : ouvre-le dans le webmail." }, 422);
    const [, kind, box, uidStr] = mt; const imapUid = Number(uidStr);
    const hub = (Deno.env.get("GMAIL_HUB") || "").trim().toLowerCase();
    const pass = box === hub ? Deno.env.get("GMAIL_APP_PASSWORD") : Deno.env.get(PASS_ENV[box] || "");
    if (!pass) return json({ error: `mot de passe introuvable pour ${box}` }, 500);

    const client = new ImapFlow({ host: "imap.mail.hostpoint.ch", port: 993, secure: true, auth: { user: box, pass: pass.trim() }, logger: false });
    await client.connect();
    let folder = "INBOX";
    if (kind === "hpspam") {
      const list = await client.list();
      // deno-lint-ignore no-explicit-any
      const j = list.find((b: any) => b.specialUse === "\\Junk") || list.find((b: any) => /^(INBOX[./])?(spam|junk|pourriel|courrier ind)/i.test(b.path));
      // deno-lint-ignore no-explicit-any
      if (j) folder = (j as any).path;
    }
    const lock = await client.getMailboxLock(folder);
    let text = "", html = "", nAtt = 0, skipped = 0;
    const atts: Record<string, unknown>[] = [];
    try {
      const msg = await client.fetchOne(imapUid, { bodyStructure: true, envelope: true }, { uid: true });
      // deno-lint-ignore no-explicit-any
      const bs = (msg as any)?.bodyStructure;
      if (!bs) throw new Error("Mail introuvable dans la boîte (déplacé ou supprimé ?)");
      for (const leaf of leaves(bs)) {
        const type = String(leaf.type || "").toLowerCase();
        const fname = leaf.dispositionParameters?.filename || leaf.parameters?.name || "";
        const isAtt = !!fname || String(leaf.disposition || "").toLowerCase() === "attachment" || !type.startsWith("text/");
        const part = leaf.part || "1";
        if (!isAtt && (type === "text/plain" || type === "text/html")) {
          const { content } = await client.download(imapUid, part, { uid: true });
          const u8 = await readAll(content, 5 * 1024 * 1024);
          const s = u8 ? new TextDecoder().decode(u8) : "";
          if (type === "text/plain" && !text) text = s; else if (type === "text/html" && !html) html = s;
          continue;
        }
        if ((leaf.size || 0) > MAX_PART * 1.4) { skipped++; continue; }
        const { content } = await client.download(imapUid, part, { uid: true });
        const u8 = await readAll(content, MAX_PART);
        if (!u8) { skipped++; continue; }
        const id = crypto.randomUUID();
        const safe = String(fname || `piece-${part}`).replace(/[^\w.\- ]+/g, "_").slice(0, 120);
        const path = `${mail_id}/${id}-${safe}`;
        const up = await supa.storage.from("mail-att").upload(path, u8, { contentType: type || "application/octet-stream", upsert: true });
        if (up.error) { skipped++; continue; }
        atts.push({ id, mail_id, filename: fname || safe, content_type: type || null, size_bytes: u8.length, content_id: String(leaf.id || "").replace(/[<>]/g, "") || null, is_inline: false, content_b64: null, storage_path: path });
        nAtt++;
      }
    } finally { lock.release(); try { await client.logout(); } catch (_) {} }

    const body = (text || strip(html || "")).trim();
    // On remplace les anciennes pièces (éventuelles) par celles qu'on vient de lire.
    await supa.from("mail_attachments").delete().eq("mail_id", mail_id);
    if (atts.length) { const { error } = await supa.from("mail_attachments").insert(atts); if (error) return json({ error: "pièces jointes : " + error.message }, 500); }
    const { error: e2 } = await supa.from("mail_messages").update({
      body_text: body || "(message sans texte)", body_html: html || null,
      snippet: (body || "").slice(0, 140) || `📎 ${nAtt} pièce(s) jointe(s)`,
    }).eq("id", mail_id);
    if (e2) return json({ error: e2.message }, 500);
    return json({ ok: true, attachments: nAtt, skipped });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
