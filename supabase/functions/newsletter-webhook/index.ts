// Edge function : webhook Resend → métriques des newsletters.
// À configurer dans Resend › Webhooks : URL = https://lnrmtwamuaqcubohontn.supabase.co/functions/v1/newsletter-webhook,
// événements : email.delivered, email.opened, email.clicked, email.bounced, email.complained.
// Secret Supabase optionnel : RESEND_WEBHOOK_SECRET (whsec_…) → vérification de signature Svix. Sans secret, accepté tel quel.
// verify_jwt = false (Resend n'a pas de jeton Supabase).
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

async function verifySvix(secret: string, req: Request, body: string): Promise<boolean> {
  const id = req.headers.get("svix-id"), ts = req.headers.get("svix-timestamp"), sig = req.headers.get("svix-signature");
  if (!id || !ts || !sig) return false;
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const keyBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return sig.split(" ").some((p) => p.split(",")[1] === expected);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true });
  try {
    const body = await req.text();
    const secret = (Deno.env.get("RESEND_WEBHOOK_SECRET") || "").trim();
    if (secret && !(await verifySvix(secret, req, body))) return json({ error: "signature invalide" }, 401);
    const ev = JSON.parse(body);
    const type: string = ev?.type || "";
    const emailId: string | undefined = ev?.data?.email_id;
    if (!emailId) return json({ ok: true, ignored: true });
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: r } = await supa.from("newsletter_recipients").select("id,status,open_count,click_count,email").eq("provider_id", emailId).maybeSingle();
    if (!r) return json({ ok: true, unknown: true });
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {};
    const rank = (s: string) => ["en_attente", "envoye", "delivre", "ouvert", "clique"].indexOf(s);
    const bump = (s: string) => { if (rank(r.status) >= 0 && rank(s) > rank(r.status)) patch.status = s; };
    if (type === "email.delivered") { patch.delivered_at = now; bump("delivre"); }
    else if (type === "email.opened") { patch.opened_at = now; patch.open_count = (r.open_count || 0) + 1; bump("ouvert"); }
    else if (type === "email.clicked") { patch.clicked_at = now; patch.click_count = (r.click_count || 0) + 1; if (!patch.opened_at && !r.open_count) { patch.opened_at = now; } bump("clique"); }
    else if (type === "email.bounced") { patch.bounced_at = now; patch.status = "rebond"; patch.error = (ev?.data?.bounce?.message || ev?.data?.bounce?.type || "bounce").toString().slice(0, 300); }
    else if (type === "email.complained") {
      patch.complained_at = now; patch.status = "spam";
      await supa.from("newsletter_unsubscribes").upsert({ email: r.email, source: "plainte spam" }, { onConflict: "email" });
    }
    else return json({ ok: true, ignored: type });
    await supa.from("newsletter_recipients").update(patch).eq("id", r.id);
    return json({ ok: true });
  } catch (e) { return json({ error: String((e as Error)?.message || e) }, 500); }
});
