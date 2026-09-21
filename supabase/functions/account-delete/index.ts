// account-delete — « Supprimer mon compte », en libre-service (exigé par Apple et Google).
// L'utilisateur connecté supprime SON compte : { confirm: "SUPPRIMER", erase_data?: boolean }.
//   1. La demande est journalisée (account_deletions) avec les fiches rattachées au compte ; si erase_data = true,
//      le secrétariat efface ensuite les données du dossier qui ne sont pas soumises à conservation légale.
//   2. Le compte est supprimé tout de suite : plus de connexion possible, téléphones et notifications retirés.
//      Si la suppression pure est impossible (le compte a créé des écritures qu'on doit garder : présences saisies,
//      cours, factures…), le compte est NEUTRALISÉ : adresse remplacée, mot de passe aléatoire, connexion bloquée,
//      rôles et lien avec la fiche retirés. Du point de vue de la personne, le résultat est le même.
// Garde-fou : un superadmin ne peut pas se supprimer ici (il faut d'abord transmettre la main).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: ures } = await asUser.auth.getUser();
    const me = ures?.user;
    if (!me?.id) return json({ error: "non authentifié" }, 401);
    const payload = await req.json().catch(() => ({}));
    if (payload.confirm !== "SUPPRIMER") return json({ error: "confirmation manquante" }, 400);

    const supa = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", me.id);
    if ((roles || []).some((r: { role: string }) => r.role === "superadmin")) {
      return json({ error: "Un superadmin ne peut pas supprimer son compte ici : il faut d'abord désigner un autre superadmin." }, 403);
    }

    const { data: fam } = await supa.rpc("family_ids_of_user", { p_user: me.id });
    const people = (fam || []) as { person_id: string; label: string }[];
    const { error: je } = await supa.from("account_deletions").insert({
      email: me.email || "", person_ids: people.map((p) => p.person_id),
      people_label: people.map((p) => p.label).join(", ") || null, erase_data: !!payload.erase_data,
    });
    if (je) return json({ error: "Demande non enregistrée : " + je.message }, 500);

    // Suppression pure (les tables liées suivent en cascade : profil, rôles, téléphones, liens de réinitialisation).
    const { error: de } = await supa.auth.admin.deleteUser(me.id);
    if (!de) return json({ ok: true, mode: "supprime" });

    // Neutralisation : le compte a laissé des écritures à conserver.
    await supa.from("push_devices").delete().eq("user_id", me.id);
    await supa.from("push_subscriptions").delete().eq("user_id", me.id);
    await supa.from("user_roles").delete().eq("user_id", me.id);
    await supa.from("profiles").delete().eq("user_id", me.id);
    const { error: ne } = await supa.auth.admin.updateUserById(me.id, {
      email: `supprime-${me.id}@supprime.invalid`, password: crypto.randomUUID() + crypto.randomUUID(),
      email_confirm: true, ban_duration: "876000h", user_metadata: {},
    });
    if (ne) return json({ error: "Suppression impossible : " + ne.message }, 500);
    return json({ ok: true, mode: "neutralise" });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
