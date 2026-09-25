// Edge function : envoi d'une newsletter via Resend (https://resend.com).
// Secrets Supabase requis : RESEND_API_KEY. Optionnel : PUBLIC_APP_URL (défaut https://app.teamlausanne.ch).
// Appel (utilisateur connecté, rôle superadmin/admin/secretaire) :
//   { id: <newsletter_id> }                 → envoie à tous les destinataires « en_attente » (lots de 50)
//   { id: <newsletter_id>, test_to: "x@y" } → envoie un e-mail de test, sans toucher aux destinataires
//     test_to accepte une adresse, une liste séparée par , ; ou saut de ligne, ou un tableau.
//     Plafonné à TEST_MAX : le test saute le verrou d'envoi, la liste des
//     destinataires et le suivi des désinscriptions. Sans plafond il deviendrait
//     une voie d'envoi en nombre échappant à toute cette comptabilité.
// Chaque e-mail contient un lien de désinscription unique (jeton = id du destinataire) + en-tête List-Unsubscribe
// (obligatoire pour ne pas finir en spam). Les ouvertures/clics/rebonds remontent par le webhook newsletter-webhook.
//
// L'envoi reel prend d'abord un VERROU (newsletter_claim_send). Sans lui, deux
// appels simultanes — un double-clic, un second onglet, un rappel de la fonction —
// lisaient la meme liste de destinataires « en_attente » et envoyaient le message
// deux fois a tout le monde, sans rattrapage possible. Le verrou est atomique, et
// une newsletter deja « envoyee » ne repart jamais.
//   { id, reprendre: true } → reprend un envoi reste bloque (fonction morte en route).
import { createClient } from "npm:@supabase/supabase-js@2";

// Un test sert à relire et à vérifier un rendu : une poignée d'adresses suffit.
// Au-delà, ce ne serait plus un test mais un envoi, et il doit alors passer par
// la voie normale (verrou, liste des destinataires, désinscriptions).
const TEST_MAX = 5;

const CORS = {
  "access-control-allow-origin": "*",
  // « authorization » doit être listé nommément : le joker « * » ne le couvre pas.
  // Le joker prend en charge les en-têtes que supabase-js ajoute au fil de ses
  // versions (x-supabase-api-version…). Sans cela, le navigateur laisse passer
  // le prévol puis bloque le POST : la fonction n'est jamais appelée, et rien
  // n'apparaît dans les journaux à part un OPTIONS orphelin.
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version, *",
  "access-control-allow-methods": "POST, OPTIONS",
};
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
  // Retenus hors du try : le corps d'une requete ne se lit qu'une fois, donc le
  // bloc d'erreur ne peut pas le relire pour savoir quel verrou liberer.
  let idEnCours: string | null = null;
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
    if (body?.id && !body?.test_to) idEnCours = String(body.id);
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

    // --- Test : quelques e-mails, destinataires intouchés ---
    // Plusieurs adresses parce que c'est précisément l'usage : faire relire
    // l'envoi par un collègue, et vérifier le rendu sur une autre boîte (Gmail
    // et Outlook ne montrent pas le même HTML).
    if (body.test_to) {
      const dests = [...new Set(
        (Array.isArray(body.test_to) ? body.test_to : String(body.test_to).split(/[,;\n]/))
          .map((s: unknown) => String(s).trim().toLowerCase()).filter(Boolean),
      )];
      if (!dests.length) return json({ error: "Aucune adresse de test." }, 400);
      const mauvaise = dests.find((a) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a));
      if (mauvaise) return json({ error: `Adresse de test invalide : ${mauvaise}` }, 400);
      if (dests.length > TEST_MAX) {
        return json({ error: `Un test va à ${TEST_MAX} adresses au maximum (${dests.length} demandées). Pour toucher plus de monde, passe par les destinataires et « Envoyer ».` }, 400);
      }
      // Un appel par adresse : chacun reçoit un message qui lui est adressé, et
      // personne ne voit les autres destinataires du test.
      const envoyes: string[] = [];
      for (const a of dests) {
        await call("/emails", build("00000000-0000-0000-0000-000000000000", a));
        envoyes.push(a);
        // Meme cadence que l'envoi reel : Resend plafonne a 2 requetes/seconde.
        if (envoyes.length < dests.length) await sleep(600);
      }
      return json({ ok: true, test: true, envoyes });
    }

    // --- Envoi réel ---
    // Le verrou AVANT la lecture : c'est l'ordre qui compte. Lire puis verrouiller
    // laissait une fenetre ou un second appel lisait la meme liste.
    // Appele au nom de l'utilisateur (et non avec la cle de service) pour que le
    // controle de droits de la fonction SQL porte sur une vraie identite.
    const { data: claim, error: eClaim } = await asUser.rpc("newsletter_claim_send", { p_id: n.id, p_reprendre: !!body.reprendre });
    if (eClaim) return json({ error: "Verrou d'envoi impossible : " + eClaim.message }, 500);
    if (!claim?.ok) {
      const raison = claim?.raison;
      const msg = raison === "deja_envoyee"   ? "Cette newsletter a déjà été envoyée. Duplique-la pour en envoyer une nouvelle."
                : raison === "envoi_en_cours" ? "Un envoi est déjà en cours pour cette newsletter. Attends qu'il se termine ; s'il est bloqué, relance avec « Reprendre l'envoi »."
                : raison === "droits"         ? "Accès réservé (admin / secrétariat)."
                : "Newsletter introuvable.";
      return json({ error: msg, raison }, 409);
    }

    // Ecarte ceux qui se sont desinscrits depuis le calcul de l'audience. Elle les
    // exclut deja, mais plusieurs minutes peuvent passer avant les derniers lots.
    const { data: purges } = await asUser.rpc("newsletter_purge_desinscrits", { p_id: n.id });

    const { data: rcpts } = await supa.from("newsletter_recipients").select("id,email").eq("newsletter_id", n.id).eq("status", "en_attente");
    const list = rcpts || [];
    if (!list.length) {
      await asUser.rpc("newsletter_release_send", { p_id: n.id, p_erreur: "Aucun destinataire en attente." });
      return json({ error: "Aucun destinataire en attente (calcule d'abord les destinataires)." }, 400);
    }
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
    return json({ ok: true, sent, errors: errors.length, desinscrits: purges || 0 });
  } catch (e) {
    // Sans cette liberation, un plantage laissait le statut « envoi » et il fallait
    // attendre le delai de reprise avant de pouvoir reessayer.
    try {
      if (idEnCours) {
        const u = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
        await u.rpc("newsletter_release_send", { p_id: idEnCours, p_erreur: String((e as Error)?.message || e) });
      }
    } catch (_) { /* la liberation est un confort, pas une obligation */ }
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
