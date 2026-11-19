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
// son propriétaire ou un superadmin), ou ?key=CRON_SECRET pour l'appel technique de mail-cron — d'où
// verify_jwt = false : la fonction fait elle-même son contrôle. Seuls les mails relevés DIRECTEMENT
// (imap_uid « hp: » ou « hpspam: ») peuvent être relus ; les anciens imports Gmail (« box: ») non.
import { ImapFlow } from "npm:imapflow@1.0.164";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, apikey, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });
// ⚠ POURQUOI DES PLAFONDS SI BAS (19.11.2026) — un mail de 22.8 Mo rendait la
// fonction muette : Supabase répondait **546 (WORKER_LIMIT)**, la mémoire du
// worker. `readAll` garde la pièce en morceaux PUIS la recopie d'un bloc, donc
// une pièce de 20 Mo en coûte 40, plus la copie passée à l'envoi. Avec l'ancien
// plafond de 50 Mo (et 70 Mo tolérés en entrée), le worker mourait AVANT
// d'avoir rien écrit — et comme le texte était enregistré à la toute fin, le
// message restait illisible dans la console. D'où les deux changements :
//   1. le TEXTE est enregistré d'abord, séparément (il pèse quelques Ko) :
//      le mail devient lisible même si les pièces jointes échouent ensuite ;
//   2. ces plafonds, tenables par un worker. Au-delà, la pièce n'est pas
//      téléchargée : elle est NOMMÉE en bas du message, avec son poids.
const MAX_PART = 12 * 1024 * 1024;   // une pièce jointe plus lourde reste dans le webmail
const BUDGET = 24 * 1024 * 1024;     // total téléchargé en un appel, toutes pièces confondues
const mo = (n: number) => (n / 1048576).toFixed(1);
// Mot de passe de chaque boîte relevée directement (mêmes secrets que mail-cron).
const PASS_ENV: Record<string, string> = {
  "tournoi@teamlausanne.ch": "GMAIL_PASS_TOURNOI",
  "raphael@teamlausanne.ch": "GMAIL_PASSE_RAPHAEL",
  "info@lausanneopen.ch": "GMAIL_PASS_LAUSANNEOPEN",
  "admin@lstennis.ch": "GMAIL_PASS_LSTENNIS",          // Infomaniak (04.11.2026)
};
// Serveur de la boîte : le repère « hp: » ne dit plus Hostpoint, il dit « relevée
// directement ». Sans ce choix, un mail lourd de LS Tennis était cherché chez
// Hostpoint, où la boîte n'existe pas — connexion refusée, import impossible.
const imapHost = (addr: string) =>
  (String(addr).toLowerCase().endsWith("@lstennis.ch") ? "mail.infomaniak.com" : "imap.mail.hostpoint.ch");
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
    if (!mt) return json({ error: "Ce mail n'est plus accessible sur le serveur (ancien import Gmail) : ouvre-le dans le webmail." }, 422);
    const [, kind, box, uidStr] = mt; const imapUid = Number(uidStr);
    const hub = (Deno.env.get("GMAIL_HUB") || "").trim().toLowerCase();
    const pass = box === hub ? Deno.env.get("GMAIL_APP_PASSWORD") : Deno.env.get(PASS_ENV[box] || "");
    if (!pass) return json({ error: `mot de passe introuvable pour ${box}` }, 500);

    const client = new ImapFlow({ host: imapHost(box), port: 993, secure: true, auth: { user: box, pass: pass.trim() }, logger: false });
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
    let text = "", html = "", nAtt = 0, skipped = 0, body = "";
    const lourdes: string[] = [];   // pièces laissées au webmail, nommées en bas du message
    let reste = BUDGET;
    try {
      const msg = await client.fetchOne(imapUid, { bodyStructure: true, envelope: true }, { uid: true });
      // deno-lint-ignore no-explicit-any
      const bs = (msg as any)?.bodyStructure;
      if (!bs) throw new Error("Mail introuvable dans la boîte (déplacé ou supprimé ?)");
      const feuilles = leaves(bs);
      // deno-lint-ignore no-explicit-any
      const nom = (leaf: any) => leaf.dispositionParameters?.filename || leaf.parameters?.name || "";
      // deno-lint-ignore no-explicit-any
      const estPJ = (leaf: any) => {
        const type = String(leaf.type || "").toLowerCase();
        return !!nom(leaf) || String(leaf.disposition || "").toLowerCase() === "attachment" || !type.startsWith("text/");
      };

      // ---- 1. LE TEXTE, et on l'enregistre TOUT DE SUITE ----------------
      // Quelques Ko. Tant qu'il est en base avant les pièces jointes, un mail
      // de 25 Mo reste lisible même si le worker meurt sur la pièce suivante.
      for (const leaf of feuilles) {
        const type = String(leaf.type || "").toLowerCase();
        if (estPJ(leaf) || (type !== "text/plain" && type !== "text/html")) continue;
        const { content } = await client.download(imapUid, leaf.part || "1", { uid: true });
        const u8 = await readAll(content, 5 * 1024 * 1024);
        const s = u8 ? new TextDecoder().decode(u8) : "";
        if (type === "text/plain" && !text) text = s; else if (type === "text/html" && !html) html = s;
      }
      body = (text || strip(html || "")).trim();
      const { error: eTxt } = await supa.from("mail_messages").update({
        body_text: body || "(message sans texte)", body_html: html || null,
        snippet: (body || "").slice(0, 140) || "📎 pièces jointes",
      }).eq("id", mail_id);
      if (eTxt) throw new Error(eTxt.message);

      // ---- 2. LES PIÈCES JOINTES, une par une ---------------------------
      // Insérées au fil de l'eau, et non en un lot final : un lot perdu avec
      // le worker ne laisse rien, alors qu'ici chaque pièce acquise est
      // acquise. (Et une ligne à la fois ne peut pas heurter PGRST102.)
      await supa.from("mail_attachments").delete().eq("mail_id", mail_id);
      for (const leaf of feuilles) {
        if (!estPJ(leaf)) continue;
        const type = String(leaf.type || "").toLowerCase();
        const fname = nom(leaf);
        const taille = leaf.size || 0;
        if (taille > MAX_PART || taille > reste) {
          lourdes.push(`${fname || "pièce sans nom"} (${mo(taille)} Mo)`); skipped++; continue;
        }
        const { content } = await client.download(imapUid, leaf.part || "1", { uid: true });
        const u8 = await readAll(content, MAX_PART);
        if (!u8) { lourdes.push(`${fname || "pièce sans nom"} (${mo(taille)} Mo)`); skipped++; continue; }
        reste -= u8.length;
        const id = crypto.randomUUID();
        const safe = String(fname || `piece-${leaf.part || "1"}`).replace(/[^\w.\- ]+/g, "_").slice(0, 120);
        const path = `${mail_id}/${id}-${safe}`;
        const up = await supa.storage.from("mail-att").upload(path, u8, { contentType: type || "application/octet-stream", upsert: true });
        if (up.error) { skipped++; continue; }
        const { error: eAtt } = await supa.from("mail_attachments").insert({
          id, mail_id, filename: fname || safe, content_type: type || null, size_bytes: u8.length,
          content_id: String(leaf.id || "").replace(/[<>]/g, "") || null, is_inline: false, content_b64: null, storage_path: path,
        });
        if (eAtt) { skipped++; continue; }
        nAtt++;
      }
    } finally { lock.release(); try { await client.logout(); } catch (_) {} }

    // Les pièces restées au webmail sont NOMMÉES sous le message : « il manque
    // quelque chose » doit se lire là où on lit le mail, pas se deviner.
    if (lourdes.length) {
      const note = `\n\n— — —\n📎 ${lourdes.length} pièce(s) jointe(s) trop lourde(s) pour la console : ${lourdes.join(", ")}.\nÀ ouvrir dans le webmail de la boîte.`;
      await supa.from("mail_messages").update({ body_text: (body || "(message sans texte)") + note }).eq("id", mail_id);
    }
    return json({ ok: true, attachments: nAtt, skipped });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
