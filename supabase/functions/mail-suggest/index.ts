// mail-suggest — « Proposer une réponse » de la messagerie : rédige un BROUILLON que le staff relit avant d'envoyer.
// v9 (19.09.2026) : l'IA ne reçoit plus seulement le mail. On lui donne du contexte :
//   1. la fiche de connaissances tenue par le secrétariat (table mail_ai_knowledge, migration 75) ;
//   2. les échanges déjà tenus avec cette personne dans la même boîte ;
//   3. quelques réponses déjà envoyées par l'équipe à des questions proches (boîtes partagées seulement).
// Elle renvoie le brouillon + des « points à vérifier » destinés au staff (jamais insérés dans le mail).
// Confidentialité : rien des fiches des jeunes ; une boîte PRIVÉE n'est lue que pour son propriétaire ou un superadmin,
// et ne sert jamais d'exemple pour les autres boîtes.
// verify_jwt = false : l'authentification est faite ICI (session staff, ou en-tête x-cron-secret pour les tests).
import Anthropic from "npm:@anthropic-ai/sdk@0.126.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version, *",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const STAFF = ["superadmin", "admin", "secretaire"];
const SIGN: Record<string, string> = {
  "info@teamlausanne.ch": "Team Lausanne Academy",
  "tournoi@teamlausanne.ch": "Team Lausanne — Tournoi",
  "info@lausanneopen.ch": "Lausanne Open",
  "admin@lstennis.ch": "LS Tennis",
  "raphael@teamlausanne.ch": "Raphael Vergnaud — Team Lausanne",
};
const SEP = "===POINTS A VERIFIER===";
const clip = (s: string | null | undefined, n: number) => { const t = String(s || "").trim(); return t.length > n ? t.slice(0, n) + " […]" : t; };

// Mots vides : on ne cherche pas des réponses « proches » sur « bonjour » ou « merci ».
const STOP = new Set(("bonjour bonsoir madame monsieur merci cordialement salutations avance votre notre nous vous avec pour dans mais donc comme cette cela celui elle elles ils leur leurs sont etre avoir fait faire plus moins tres bien aussi alors encore depuis avant apres entre sans sous chez quel quelle quels quelles est-ce serait pourrait pouvez voulais voudrais souhaite souhaiterais savoir question questions message demande demander reponse team lausanne tennis site ecrire hello dear thank thanks please would could regards").split(" "));
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
function keywords(text: string): string[] {
  const freq: Record<string, number> = {};
  for (const w of norm(text).split(/[^a-z0-9]+/)) { if (w.length < 5 || STOP.has(w) || /^\d+$/.test(w)) continue; freq[w] = (freq[w] || 0) + 1; }
  return Object.entries(freq).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 7).map(([w]) => w);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "Cle ANTHROPIC_API_KEY manquante dans Supabase." }, 400);

    const supa = createClient(url, service);
    // Mode technique (tests, maintenance) : l'en-tête x-cron-secret = CRON_SECRET donne les droits superadmin, comme pour mail-import-box.
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    let uid: string | undefined, isSuper = false;
    if (cronSecret && req.headers.get("x-cron-secret") === cronSecret) {
      isSuper = true;
    } else {
      const authHeader = req.headers.get("Authorization") || "";
      const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
      const { data: ures } = await asUser.auth.getUser();
      uid = ures?.user?.id;
      if (!uid) return json({ error: "non authentifie" }, 401);
      const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", uid);
      if (!(roles || []).some((r: { role: string }) => STAFF.includes(r.role))) return json({ error: "reserve au secretariat/admin" }, 403);
      isSuper = (roles || []).some((r: { role: string }) => r.role === "superadmin");
    }

    const { id } = await req.json();
    const { data: m } = await supa.from("mail_messages").select("*").eq("id", id).single();
    if (!m) return json({ error: "message introuvable" }, 404);
    const account = String(m.account_address || "").toLowerCase();

    // Boîtes privées : même règle que l'envoi. Et on retient leur liste pour ne jamais y puiser d'exemples.
    const { data: accs } = await supa.from("mail_accounts").select("address,private_user_id");
    const privateBoxes = new Set((accs || []).filter((a: { private_user_id: string | null }) => a.private_user_id).map((a: { address: string }) => a.address.toLowerCase()));
    const owner = (accs || []).find((a: { address: string }) => a.address.toLowerCase() === account)?.private_user_id || null;
    if (owner && owner !== uid && !isSuper) return json({ error: "boite privee : reservee a son proprietaire" }, 403);

    const sign = SIGN[account] || "Team Lausanne Academy";
    const bodyIn = clip(m.body_text || m.snippet, 6000);
    const who = String(m.from_address || "").toLowerCase();

    // 1. Fiche de connaissances
    const { data: kn } = await supa.from("mail_ai_knowledge").select("body").eq("id", 1).maybeSingle();
    const fiche = clip(kn?.body, 24000);

    // 2. Échanges déjà tenus avec cette personne, dans cette boîte (du plus ancien au plus récent)
    let thread: { direction: string; received_at: string; subject: string | null; body_text: string | null }[] = [];
    if (who) {
      const safe = who.replace(/[,()%*]/g, "");
      const { data: th } = await supa.from("mail_messages")
        .select("id,direction,received_at,subject,body_text,is_spam")
        .eq("account_address", m.account_address).neq("id", m.id)
        .or(`from_address.ilike.${safe},to_address.ilike.%${safe}%`)
        .order("received_at", { ascending: false }).limit(8);
      thread = (th || []).filter((x: { is_spam?: boolean }) => !x.is_spam).reverse();
    }

    // 3. Réponses déjà envoyées à des questions proches (boîtes partagées uniquement, hors envois automatiques)
    const kws = keywords(`${m.subject || ""} ${bodyIn}`);
    let examples: { subject: string | null; body_text: string | null }[] = [];
    if (kws.length) {
      const { data: outs } = await supa.from("mail_messages")
        .select("account_address,to_address,subject,body_text,received_at")
        .eq("direction", "out").or(kws.map((k) => `body_text.ilike.%${k}%`).join(","))
        .order("received_at", { ascending: false }).limit(60);
      const scored = (outs || [])
        .filter((o: { account_address: string; to_address: string | null; subject: string | null; body_text: string | null }) =>
          !privateBoxes.has(String(o.account_address || "").toLowerCase())
          && !(who && String(o.to_address || "").toLowerCase().includes(who))
          && !/^votre brochure/i.test(o.subject || "")
          && String(o.body_text || "").trim().length > 80)
        .map((o: { subject: string | null; body_text: string | null }) => { const t = norm(`${o.subject || ""} ${o.body_text || ""}`); return { o, score: kws.filter((k) => t.includes(k)).length }; })
        .filter((x: { score: number }) => x.score >= 2)
        .sort((a: { score: number }, b: { score: number }) => b.score - a.score).slice(0, 3);
      examples = scored.map((x: { o: { subject: string | null; body_text: string | null } }) => x.o);
    }

    const system = `Tu rédiges, pour le secrétariat de ${sign} (académie de tennis à Lausanne), le brouillon d'une réponse à un e-mail reçu. Une personne de l'équipe relira ce brouillon avant de l'envoyer.

Ce qui fait une bonne réponse ici : elle répond vraiment à la question posée, avec les informations concrètes de la fiche de connaissances (prix, horaires, personne à contacter) quand elles s'y trouvent. Une réponse qui renvoie vers « contactez-nous » alors que l'information figure dans la fiche est une mauvaise réponse.

Les informations fiables sont : la fiche de connaissances, puis les échanges précédents avec cette personne, puis les réponses déjà envoyées par l'équipe (elles montrent le ton et les réponses habituelles, mais peuvent dater : en cas de contradiction, la fiche l'emporte). En dehors de ces sources, n'avance aucun fait précis (prix, date, horaire, disponibilité, confirmation d'inscription) : dis plutôt que l'équipe vérifie et revient vers la personne, ou indique qui contacter. Les passages [À COMPLÉTER] de la fiche sont des trous : ne les cite pas et ne les comble pas.

Forme : réponds dans la langue du message reçu (français par défaut), avec le niveau de politesse indiqué dans la fiche ; ton chaleureux et professionnel, phrases simples, pas de remplissage ; formule d'appel adaptée au nom de la personne, formule de politesse courte, puis la signature « ${sign} ». Texte brut, sans objet, sans mise en forme Markdown.

Après le brouillon, écris sur une ligne seule ${SEP} puis, à l'attention de l'équipe (ce texte ne sera pas envoyé), au plus trois points courts : ce que tu n'as pas pu confirmer, ce qui mérite une vérification avant envoi, ou une information manquante dans la fiche qui t'aurait permis de mieux répondre. S'il n'y a rien à signaler, écris « rien ».

<fiche_de_connaissances>
${fiche || "(fiche vide)"}
</fiche_de_connaissances>`;

    const parts: string[] = [];
    if (thread.length) {
      parts.push("<echanges_precedents_avec_cette_personne>\n" + thread.map((t) =>
        `[${String(t.received_at).slice(0, 10)} — ${t.direction === "out" ? "NOUS" : "LA PERSONNE"}] ${t.subject || ""}\n${clip(t.body_text, 1500)}`).join("\n---\n") + "\n</echanges_precedents_avec_cette_personne>");
    }
    if (examples.length) {
      parts.push("<reponses_deja_envoyees_par_l_equipe_sur_des_sujets_proches>\n" + examples.map((e) =>
        `Objet : ${e.subject || ""}\n${clip(e.body_text, 1200)}`).join("\n---\n") + "\n</reponses_deja_envoyees_par_l_equipe_sur_des_sujets_proches>");
    }
    parts.push(`<email_recu>\nDe : ${m.from_name || ""} <${m.from_address || ""}>\nBoîte : ${account}\nObjet : ${m.subject || ""}\n\n${bodyIn}\n</email_recu>`);

    const client = new Anthropic();   // lit ANTHROPIC_API_KEY dans l'environnement
    let response;
    try {
      // `fallbacks` : si le modèle principal décline une demande, l'API la rejoue sur le modèle de repli dans le même appel.
      response = await client.beta.messages.create({
        model: "claude-opus-5",
        max_tokens: 16000,
        output_config: { effort: "medium" },   // un mail court : inutile de réfléchir longtemps, et le staff attend devant l'écran
        betas: ["server-side-fallback-2026-06-01"],
        fallbacks: [{ model: "claude-opus-4-8" }],
        system,
        messages: [{ role: "user", content: parts.join("\n\n") }],
        // deno-lint-ignore no-explicit-any
      } as any);
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) return json({ error: "IA : cle ANTHROPIC_API_KEY invalide." }, 500);
      if (error instanceof Anthropic.RateLimitError) return json({ error: "IA : trop de demandes, reessaie dans une minute." }, 429);
      if (error instanceof Anthropic.APIError) return json({ error: `IA (${error.status}) : ${String(error.message).slice(0, 300)}` }, 500);
      throw error;
    }
    if (response.stop_reason === "refusal") return json({ error: "L'IA a decline cette demande. Redige la reponse a la main." }, 422);

    let full = "";
    for (const block of response.content) if (block.type === "text") full += block.text;
    full = full.trim();
    const cut = full.indexOf(SEP);
    const draft = (cut >= 0 ? full.slice(0, cut) : full).trim();
    const notesRaw = cut >= 0 ? full.slice(cut + SEP.length).trim() : "";
    const notes = /^rien\.?$/i.test(notesRaw) ? "" : notesRaw;
    return json({ ok: true, draft, notes, context: { fiche: !!fiche, echanges: thread.length, exemples: examples.length }, model: response.model });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
