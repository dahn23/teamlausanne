// Edge function : envoi d'une newsletter via Resend (https://resend.com).
// Secrets Supabase requis : RESEND_API_KEY. Optionnel : PUBLIC_APP_URL (défaut https://app.teamlausanne.ch).
// Appel (utilisateur connecté, rôle superadmin/admin/secretaire) :
//   { id: <newsletter_id> }                 → envoie à tous les destinataires « en_attente » (lots de 50)
//   { id: <newsletter_id>, test_to: "x@y" } → envoie UN e-mail de test, sans toucher aux destinataires
// Chaque e-mail contient un lien de désinscription unique (jeton = id du destinataire) + en-tête List-Unsubscribe
// (obligatoire pour ne pas finir en spam). Les ouvertures/clics/rebonds remontent par le webhook newsletter-webhook.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, apikey, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stripHtml = (h: string) => h.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h\d|li|tr)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();

function wrapHtml(inner: string, unsubUrl: string, fromName: string) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f5fa;font-family:Helvetica,Arial,sans-serif;color:#1a1f36">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5fa"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#1e3ad1;padding:16px 24px;color:#ffffff;font-weight:700;font-size:16px">${fromName}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55">${inner}</td></tr>
<tr><td style="padding:16px 24px;background:#f7f8fc;color:#6b7280;font-size:12px;line-height:1.5">
TC Lausanne-Sports · Team Lausanne Academy · Route des Plaines-du-Loup 7, 1018 Lausanne<br>
Vous recevez ce message parce que vous êtes en contact avec Team Lausanne. <a href="${unsubUrl}" style="color:#1e3ad1">Se désinscrire</a>
</td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const RESEND = (Deno.env.get("RESEND_API_KEY") || "").trim();
    const base = (Deno.env.get("PUBLIC_APP_URL") || "https://app.teamlausanne.ch").replace(/\/$/, "");
    const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: ures } = await asUser.auth.getUser();
    const uid = ures?.user?.id;
    if (!uid) return json({ error: "Non authentifié." }, 401);
    const supa = createClient(url, service);
    const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", uid);
    if (!(roles || []).some((r: { role: string }) => ["superadmin", "admin", "secretaire"].includes(r.role))) return json({ error: "Accès réservé (admin / secrétariat)." }, 403);
    if (!RESEND) return json({ error: "Clé RESEND_API_KEY absente des secrets Supabase (Edge Functions › Secrets). Envoi impossible." }, 400);

    const body = await req.json().catch(() => ({}));
    const { data: n, error: en } = await supa.from("newsletters").select("*").eq("id", body.id).single();
    if (en || !n) return json({ error: "Newsletter introuvable." }, 404);
    if (!n.subject?.trim() || !n.html?.trim()) return json({ error: "Objet et contenu obligatoires." }, 400);
    const from = `${n.from_name} <${n.from_email}>`;
    const build = (rcptId: string, to: string) => {
      const unsub = `${base}/desinscription.html?t=${rcptId}`;
      const html = wrapHtml(n.html, unsub, n.from_name);
      const text = (n.text_body?.trim() || stripHtml(n.html)) + `\n\n— Se désinscrire : ${unsub}`;
      return { from, to: [to], subject: n.subject, html, text, reply_to: n.reply_to || undefined,
        headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        tags: [{ name: "newsletter", value: String(n.id).replace(/-/g, "") }] };
    };
    const call = async (path: string, payload: unknown) => {
      const r = await fetch("https://api.resend.com" + path, { method: "POST", headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || j?.error?.message || `Resend HTTP ${r.status}`);
      return j;
    };

    // --- Test : un seul e-mail, destinataires intouchés ---
    if (body.test_to) {
      const j = await call("/emails", build("00000000-0000-0000-0000-000000000000", String(body.test_to).trim()));
      return json({ ok: true, test: true, id: j?.id });
    }

    // --- Envoi réel ---
    const { data: rcpts } = await supa.from("newsletter_recipients").select("id,email").eq("newsletter_id", n.id).eq("status", "en_attente");
    const list = rcpts || [];
    if (!list.length) return json({ error: "Aucun destinataire en attente (calcule d'abord les destinataires)." }, 400);
    await supa.from("newsletters").update({ status: "envoi", last_error: null }).eq("id", n.id);
    let sent = 0; const errors: string[] = [];
    for (let i = 0; i < list.length; i += 50) {
      const chunk = list.slice(i, i + 50);
      try {
        const j = await call("/emails/batch", chunk.map((r: { id: string; email: string }) => build(r.id, r.email)));
        const ids: string[] = (j?.data || []).map((x: { id: string }) => x.id);
        for (let k = 0; k < chunk.length; k++) {
          await supa.from("newsletter_recipients").update({ status: "envoye", provider_id: ids[k] || null, sent_at: new Date().toISOString() }).eq("id", chunk[k].id);
        }
        sent += chunk.length;
      } catch (e) {
        const msg = String((e as Error)?.message || e); errors.push(msg);
        for (const r of chunk) await supa.from("newsletter_recipients").update({ status: "erreur", error: msg.slice(0, 300) }).eq("id", r.id);
      }
      if (i + 50 < list.length) await sleep(600);   // limite Resend : 2 requêtes / seconde
    }
    await supa.from("newsletters").update({ status: "envoyee", sent_at: new Date().toISOString(), sent_by: uid, n_sent: sent, last_error: errors.length ? errors.slice(0, 3).join(" | ").slice(0, 500) : null }).eq("id", n.id);
    return json({ ok: true, sent, errors: errors.length });
  } catch (e) { return json({ error: String((e as Error)?.message || e) }, 500); }
});
