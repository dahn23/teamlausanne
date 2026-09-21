// portal-activate — activation d'un accès « Mon espace » à partir du lien d'invitation (activer.html?t=<jeton>).
// Publique (pas de JWT : la famille n'a pas encore de compte utilisable) ; la seule clé est le jeton de
// portal_invites : un UUID aléatoire, à usage unique, valable 30 jours.
//   • action "info"     : { token } -> { ok, email, prenoms } si le lien est valable (pour accueillir la famille).
//   • action "activate" : { token, password } -> pose le mot de passe choisi, confirme l'e-mail, consomme le jeton.
// Le mot de passe n'est ni journalisé ni renvoyé ; la page se connecte ensuite normalement avec.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const joinNames = (n: string[]) => (n.length <= 1 ? (n[0] || "") : n.slice(0, -1).join(", ") + " et " + n[n.length - 1]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || "");
    const token = String(payload.token || "").trim();
    const BAD = "Ce lien n'est pas valable. Demande un nouveau lien au secrétariat (info@teamlausanne.ch).";
    if (!UUID.test(token)) return json({ error: BAD }, 400);

    const { data: inv } = await supa.from("portal_invites").select("id,email,person_ids,user_id,used_at,expires_at").eq("token", token).maybeSingle();
    if (!inv || !inv.user_id) return json({ error: BAD }, 404);
    if (inv.used_at) return json({ error: "Ce lien a déjà servi : ton accès est actif. Connecte-toi avec ton e-mail et ton mot de passe.", used: true }, 409);
    if (new Date(inv.expires_at).getTime() < Date.now()) return json({ error: "Ce lien a expiré. Demande un nouveau lien au secrétariat (info@teamlausanne.ch)." }, 410);

    if (action === "info") {
      const { data: kids } = await supa.from("people").select("first_name").in("id", inv.person_ids || []).order("first_name");
      return json({ ok: true, email: inv.email, prenoms: joinNames((kids || []).map((k: { first_name: string }) => k.first_name)) });
    }

    if (action === "activate") {
      const password = String(payload.password || "");
      if (password.length < 8) return json({ error: "Le mot de passe doit faire au moins 8 caractères." }, 400);
      if (password.length > 72) return json({ error: "Mot de passe trop long (72 caractères maximum)." }, 400);
      const { error } = await supa.auth.admin.updateUserById(inv.user_id, { password, email_confirm: true });
      if (error) return json({ error: "Activation impossible : " + error.message }, 400);
      await supa.from("portal_invites").update({ used_at: new Date().toISOString() }).eq("id", inv.id);
      return json({ ok: true, email: inv.email });
    }

    return json({ error: "action inconnue" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
