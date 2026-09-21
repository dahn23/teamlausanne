// push-native — envoi des notifications vers l'app native (Android, puis iOS) par Firebase Cloud Messaging (API HTTP v1).
// Appelée UNIQUEMENT par nos propres fonctions serveur (en-tête x-cron-secret) : jamais depuis un navigateur.
//   body : { messages: [{ user_id, title, body, url? }] }  -> un envoi par téléphone enregistré (table push_devices).
// Secret FCM_SERVICE_ACCOUNT = le fichier JSON « compte de service » de Firebase (posé par Dan dans Supabase).
// Un téléphone dont le jeton n'existe plus (app désinstallée) est retiré de la table.
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

// Jeton d'accès Google (valable 1 h) obtenu à partir du compte de service : JWT signé RS256 -> échange OAuth2.
async function googleAccessToken(sa: { client_email: string; private_key: string; token_uri?: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
  const unsigned = enc({ alg: "RS256", typ: "JWT" }) + "." + enc({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: tokenUri, iat: now, exp: now + 3600,
  });
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const res = await fetch(tokenUri, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + b64url(sig) }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error("jeton Google refusé : " + (j.error_description || j.error || res.status));
  return j.access_token as string;
}

Deno.serve(async (req) => {
  try {
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) return json({ error: "réservé au serveur" }, 403);
    const raw = Deno.env.get("FCM_SERVICE_ACCOUNT") || "";
    if (!raw) return json({ error: "secret FCM_SERVICE_ACCOUNT manquant" }, 400);
    let sa: { project_id: string; client_email: string; private_key: string; token_uri?: string };
    try { sa = JSON.parse(raw); } catch (_e) { return json({ error: "FCM_SERVICE_ACCOUNT n'est pas un JSON valide (coller TOUT le fichier)" }, 400); }
    if (!sa.project_id || !sa.client_email || !sa.private_key) return json({ error: "FCM_SERVICE_ACCOUNT incomplet" }, 400);

    const payload = await req.json().catch(() => ({}));
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Diagnostic sans envoi : { action: "check" } -> le secret est lisible, Google l'accepte, N téléphones enregistrés.
    if (payload.action === "check") {
      await googleAccessToken(sa);
      const { count } = await supa.from("push_devices").select("id", { count: "exact", head: true });
      return json({ ok: true, project: sa.project_id, devices: count || 0 });
    }

    // { action: "mails" } — lancé toutes les 2 min par la base (pg_cron), juste après la relève : notifie les nouveaux mails
    // entrants pas encore notifiés sur téléphone (mail_messages.pushed_native). On NE TOUCHE PAS à mail-cron.
    // Mêmes règles que les notifications navigateur : staff seulement (superadmin / admin / secrétaire) ; une boîte privée
    // n'est notifiée qu'à son propriétaire et aux superadmins ; ni spam, ni mails rangés d'office (rapports DMARC).
    let messages: { user_id: string; title: string; body: string; url?: string }[] = Array.isArray(payload.messages) ? payload.messages : [];
    if (payload.action === "mails") {
      const cutoff = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      const { data: mails } = await supa.from("mail_messages")
        .select("id,from_name,from_address,subject,account_address")
        .eq("direction", "in").eq("pushed_native", false).eq("is_spam", false).eq("status", "a_traiter")
        .gte("received_at", cutoff).order("received_at", { ascending: false }).limit(20);
      // On marque précisément : les mails retenus (par id), puis ceux qui n'ont pas à être notifiés (spam, déjà traités,
      // trop vieux). Jamais un « tout marquer » : un mail arrivé entre la lecture et l'écriture serait perdu.
      const ids = (mails || []).map((m: { id: string }) => m.id);
      if (ids.length) await supa.from("mail_messages").update({ pushed_native: true }).in("id", ids);
      await supa.from("mail_messages").update({ pushed_native: true }).eq("pushed_native", false)
        .or(`is_spam.eq.true,status.neq.a_traiter,direction.neq.in,received_at.lt.${cutoff}`);
      if (!ids.length) return json({ ok: true, found: 0, sent: 0 });
      const { data: accs } = await supa.from("mail_accounts").select("address,label,private_user_id");
      const accLabel: Record<string, string> = {}; const accOwner: Record<string, string | null> = {};
      (accs || []).forEach((a: { address: string; label?: string; private_user_id?: string | null }) => { accLabel[a.address] = a.label || a.address; accOwner[a.address] = a.private_user_id || null; });
      const { data: staffRoles } = await supa.from("user_roles").select("user_id,role").in("role", ["superadmin", "admin", "secretaire"]);
      const staffIds = [...new Set((staffRoles || []).map((r: { user_id: string }) => r.user_id))] as string[];
      const superIds = new Set((staffRoles || []).filter((r: { role: string }) => r.role === "superadmin").map((r: { user_id: string }) => r.user_id));
      type M = { from_name?: string; from_address?: string; subject?: string; account_address?: string };
      const nm = (m: M) => m.from_name || m.from_address || "?";
      const boxOf = (m: M) => accLabel[m.account_address || ""] || m.account_address || "";
      messages = [];
      for (const uid of staffIds) {
        const visible = (mails as M[]).filter((m) => { const o = accOwner[m.account_address || ""]; return !o || o === uid || superIds.has(uid); });
        if (!visible.length) continue;
        const n = visible.length;
        messages.push({
          user_id: uid, url: "/console",
          title: n === 1 ? `Nouveau mail — ${boxOf(visible[0])}` : `${n} nouveaux mails`,
          body: n === 1 ? `${nm(visible[0])} : ${visible[0].subject || "(sans objet)"}` : visible.slice(0, 3).map((m) => `${boxOf(m)} • ${nm(m)} : ${m.subject || "(sans objet)"}`).join("\n"),
        });
      }
    }
    if (!messages.length) return json({ ok: true, sent: 0, devices: 0 });
    const userIds = [...new Set(messages.map((m) => m.user_id).filter(Boolean))];
    const { data: devices } = await supa.from("push_devices").select("token,user_id,platform").in("user_id", userIds);
    if (!devices || !devices.length) return json({ ok: true, sent: 0, devices: 0 });

    const access = await googleAccessToken(sa);
    const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
    let sent = 0; let error: string | null = null;
    for (const m of messages) {
      for (const d of devices.filter((x: { user_id: string }) => x.user_id === m.user_id)) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { authorization: "Bearer " + access, "content-type": "application/json" },
          body: JSON.stringify({ message: {
            token: d.token,
            notification: { title: String(m.title || "Team Lausanne").slice(0, 120), body: String(m.body || "").slice(0, 900) },
            data: { url: String(m.url || "/") },
            android: { priority: "HIGH", notification: { channel_id: "general" } },   // HIGH : livraison immédiate, même téléphone en veille
          } }),
        });
        if (res.ok) { sent++; continue; }
        const j = await res.json().catch(() => ({}));
        const status = j?.error?.status || String(res.status);
        // Jeton mort (app désinstallée, données effacées) : on retire le téléphone.
        if (res.status === 404 || status === "UNREGISTERED" || status === "NOT_FOUND") await supa.from("push_devices").delete().eq("token", d.token);
        if (!error) error = `${status} ${String(j?.error?.message || "").slice(0, 200)}`;
      }
    }
    return json({ ok: true, sent, devices: devices.length, error });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
