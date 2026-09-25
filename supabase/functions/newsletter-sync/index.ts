// newsletter-sync — rattrapage des statistiques d'une newsletter envoyée AVANT la mise en place du webhook Resend
// (25.09.2026). Pour chaque destinataire, lit le dernier état de l'e-mail chez Resend (GET /emails/{id} →
// last_event : delivered, opened, clicked, bounced, complained) et complète newsletter_recipients sans jamais
// écraser ce que le webhook a déjà écrit. Les heures exactes ne sont pas connues : on met l'heure d'envoi.
// Appel : POST ?key=<CRON_SECRET>  body { newsletter_id, after?: <id du dernier traité>, max?: 120 }
// Réponse : { done, next_after, fin } — rappeler avec after = next_after jusqu'à fin = true.
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RANK = ["en_attente", "envoye", "delivre", "ouvert", "clique"];

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get("CRON_SECRET") || "";
    const key = new URL(req.url).searchParams.get("key") || req.headers.get("x-cron-secret") || "";
    if (!secret || key !== secret) return json({ error: "forbidden" }, 403);
    const RESEND = (Deno.env.get("RESEND_API_KEY") || "").trim();
    if (!RESEND) return json({ error: "RESEND_API_KEY absente" }, 400);
    const body = await req.json().catch(() => ({}));
    const nid = String(body.newsletter_id || "");
    if (!nid) return json({ error: "newsletter_id requis" }, 400);
    const max = Math.min(Number(body.max) || 120, 200);
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let q = supa.from("newsletter_recipients").select("id,email,status,provider_id,sent_at,delivered_at,opened_at,clicked_at,open_count,click_count,bounced_at,complained_at")
      .eq("newsletter_id", nid).not("provider_id", "is", null).order("id").limit(max);
    if (body.after) q = q.gt("id", String(body.after));
    const { data: rows, error } = await q;
    if (error) return json({ error: error.message }, 500);
    const stats: Record<string, number> = {};
    let last: string | null = null;
    for (const r of rows || []) {
      last = r.id;
      let ev = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(`https://api.resend.com/emails/${r.provider_id}`, { headers: { Authorization: `Bearer ${RESEND}` } });
        if (res.status === 429) { await sleep(1200); continue; }
        const j = await res.json().catch(() => ({}));
        ev = String(j?.last_event || "");
        break;
      }
      stats[ev || "inconnu"] = (stats[ev || "inconnu"] || 0) + 1;
      const t = r.sent_at || new Date().toISOString();
      const patch: Record<string, unknown> = {};
      const bump = (s: string) => { if (RANK.indexOf(r.status) >= 0 && RANK.indexOf(s) > RANK.indexOf(r.status)) patch.status = s; };
      if (["delivered", "opened", "clicked"].includes(ev) && !r.delivered_at) patch.delivered_at = t;
      if (ev === "delivered") bump("delivre");
      if (ev === "opened" || ev === "clicked") {
        if (!r.opened_at) patch.opened_at = t;
        if (!r.open_count) patch.open_count = 1;
        bump("ouvert");
      }
      if (ev === "clicked") {
        if (!r.clicked_at) patch.clicked_at = t;
        if (!r.click_count) patch.click_count = 1;
        bump("clique");
      }
      if (ev === "bounced" && !r.bounced_at) { patch.bounced_at = t; patch.status = "rebond"; }
      if (ev === "complained" && !r.complained_at) {
        patch.complained_at = t; patch.status = "spam";
        await supa.from("newsletter_unsubscribes").upsert({ email: r.email, source: "plainte spam" }, { onConflict: "email" });
      }
      if (Object.keys(patch).length) await supa.from("newsletter_recipients").update(patch).eq("id", r.id);
      await sleep(550);   // limite Resend : 2 requêtes / seconde
    }
    return json({ ok: true, done: (rows || []).length, next_after: last, fin: (rows || []).length < max, stats });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
