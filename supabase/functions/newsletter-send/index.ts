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
//
// Quota Resend : le compte a un plafond d'e-mails par jour (partagé avec tout le
// reste de l'appli — invitations, reset de mot de passe, notifications…). Un gros
// envoi peut donc heurter ce plafond en cours de route. Avant, la fonction
// marquait alors TOUT le reste de la liste comme « erreur » définitive et scellait
// quand même la newsletter en « envoyee » : les destinataires restants ne
// recevaient plus jamais rien, sans qu'on puisse reprendre. Désormais, une erreur
// de quota arrête proprement l'envoi, laisse les destinataires restants
// « en_attente » (rien n'est perdu) et repasse la newsletter en « erreur » —
// reprenable dès que le quota se renouvelle (ou que le plan Resend est augmenté),
// via le même bouton d'envoi.
//
// ---- {{lien_activation}} : la newsletter EST l'invitation (05.11.2026) ----
//
// Écrire {{lien_activation}} dans le contenu (typiquement comme adresse d'un
// bouton) donne à CHAQUE destinataire son propre lien d'activation de Mon espace.
// Avant, il fallait deux e-mails : l'invitation nue de portal-invite, puis la
// belle newsletter qui disait « vous avez reçu un e-mail ». Les familles
// cherchaient un message qui n'était jamais parti.
//
// Ce que fait la substitution, destinataire par destinataire :
//   • compte déjà actif  → lien simple vers l'app (se connecter), pas d'activation ;
//   • aucun jeune cette saison → lien simple vers l'app, et rien n'est créé ;
//   • sinon → compte créé sans mot de passe connu + jeton portal_invites (30 j).
//
// Un jeton NON UTILISÉ et NON EXPIRÉ déjà présent pour cette adresse est
// RÉUTILISÉ. C'est ce qui rend deux envois inoffensifs : une famille présente
// dans deux filières, ou un rappel envoyé la semaine suivante, reçoit le même
// lien. Sans cela, le second e-mail aurait périmé le premier dans la tête des
// gens sans qu'on sache lequel ils avaient ouvert.
//
// GARDE-FOU : un envoi porteur de {{lien_activation}} crée de vrais comptes. Il
// est donc soumis au MÊME interrupteur que les invitations
// (portal_invite_config.sending_enabled). Éteint = refus net, avant le premier
// e-mail. Un brouillon parti par erreur ne peut pas ouvrir 180 comptes.
// Le mode test, lui, ne crée jamais rien : il montre un lien d'exemple.
import { createClient } from "npm:@supabase/supabase-js@2";

// Un test sert à relire et à vérifier un rendu : une poignée d'adresses suffit.
// Au-delà, ce ne serait plus un test mais un envoi, et il doit alors passer par
// la voie normale (verrou, liste des destinataires, désinscriptions).
const TEST_MAX = 5;

// Le gabarit écrit dans le contenu de la newsletter.
const JETON = "{{lien_activation}}";

// Reconnaît les refus Resend liés à un plafond (quota quotidien/mensuel ou
// rate-limit) plutôt qu'à un problème définitif (adresse invalide, domaine
// rejeté, etc.) : seuls ceux-ci doivent redevenir « en_attente » pour repartir
// tout seuls au prochain essai.
const QUOTA_RE = /quota|rate.?limit|too many requests|429/i;

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
    const avecActivation = String(n.html).includes(JETON) || String(n.text_body || "").includes(JETON);

    const build = (rcptId: string, to: string, lien?: string) => {
      const unsub = `${base}/desinscription.html?t=${rcptId}`;
      // split/join plutôt que replace : un remplacement global sans regex, donc
      // sans échappement à prévoir dans le lien.
      const corps = lien ? String(n.html).split(JETON).join(lien) : n.html;
      const html = wrapHtml(corps, unsub, n.from_name);
      const brut = n.text_body?.trim() || stripHtml(corps);
      const text = (lien ? brut.split(JETON).join(lien) : brut) + `\n\n— Se désinscrire : ${unsub}`;
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

    // Le lien d'activation d'UNE adresse. Voir l'en-tête du fichier pour les
    // trois cas. Ne lève jamais : un échec rend le lien simple vers l'app, pour
    // qu'un destinataire problématique ne fasse pas tomber tout le lot.
    const bilan = { crees: 0, reutilises: 0, deja_actifs: 0, sans_jeune: 0, echecs: 0 };
    async function lienDe(email: string): Promise<string> {
      try {
        const { data: ex } = await supa.rpc("portal_user_by_email", { p_email: email });
        if (ex?.[0]?.activated) { bilan.deja_actifs++; return base; }
        const { data: fam } = await supa.rpc("portal_family_of_email", { p_email: email });
        const kids = (fam || []) as { person_id: string; first_name: string }[];
        if (!kids.length) { bilan.sans_jeune++; return base; }

        // Un jeton encore valable pour cette adresse est repris tel quel.
        const { data: dejaLa } = await supa.from("portal_invites")
          .select("token").eq("email", email).is("used_at", null).gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (dejaLa?.token) { bilan.reutilises++; return `${base}/activer.html?t=${dejaLa.token}`; }

        let userId: string | null = ex?.[0]?.user_id || null;
        if (!userId) {
          // Mot de passe aléatoire que personne ne connaît : la famille choisira
          // le sien sur activer.html.
          const { data: cu, error: ce } = await supa.auth.admin.createUser({
            email, password: crypto.randomUUID() + crypto.randomUUID(), email_confirm: false });
          if (ce || !cu?.user?.id) { bilan.echecs++; return base; }
          userId = cu.user.id;
        }
        const { data: prof } = await supa.from("profiles").select("user_id").eq("user_id", userId).maybeSingle();
        if (!prof) await supa.from("profiles").insert({ user_id: userId, person_id: kids[0].person_id });
        const { data: inv, error: ie } = await supa.from("portal_invites")
          .insert({ email, person_ids: kids.map((k) => k.person_id), user_id: userId, created_by: uid })
          .select("token").single();
        if (ie || !inv) { bilan.echecs++; return base; }
        bilan.crees++;
        return `${base}/activer.html?t=${inv.token}`;
      } catch (_e) {
        bilan.echecs++;
        return base;
      }
    }

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
      // Un test ne crée AUCUN compte et ne consomme aucun jeton : le bouton
      // d'activation mène à la page avec un lien d'exemple, qui affichera
      // « lien invalide ». C'est voulu — on vérifie le rendu, pas le parcours.
      const lienExemple = avecActivation ? `${base}/activer.html?t=exemple` : undefined;
      // Un appel par adresse : chacun reçoit un message qui lui est adressé, et
      // personne ne voit les autres destinataires du test.
      const envoyes: string[] = [];
      for (const a of dests) {
        await call("/emails", build("00000000-0000-0000-0000-000000000000", a, lienExemple));
        envoyes.push(a);
        // Meme cadence que l'envoi reel : Resend plafonne a 2 requetes/seconde.
        if (envoyes.length < dests.length) await sleep(600);
      }
      return json({ ok: true, test: true, envoyes, activation: avecActivation });
    }

    // --- Envoi réel ---
    // Une newsletter porteuse de {{lien_activation}} ouvre de vrais comptes :
    // elle passe par le même interrupteur que les invitations. Vérifié AVANT le
    // verrou, pour ne pas laisser une newsletter coincée en « envoi » sur un
    // refus de droits.
    if (avecActivation) {
      const { data: cfg } = await supa.from("portal_invite_config").select("sending_enabled").eq("id", 1).maybeSingle();
      if (!cfg?.sending_enabled) {
        return json({ error: "Cette newsletter contient un lien d'activation : elle crée des comptes. "
          + "Les envois d'invitation sont désactivés (Accès › « Envois activés »). Rien n'est parti." }, 423);
      }
    }

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
    let sent = 0; let erreurCount = 0; const errors: string[] = [];
    let quotaHit = false; let quotaMsg = "";
    for (let i = 0; i < list.length; i += 50) {
      const chunk = list.slice(i, i + 50);
      try {
        // Les liens se préparent lot par lot, et non tous d'avance : créer 180
        // comptes avant le premier e-mail allongerait l'appel au point de le
        // faire expirer sans qu'une seule lettre soit partie.
        const liens: string[] = [];
        if (avecActivation) for (const r of chunk) liens.push(await lienDe(r.email));

        const j = await call("/emails/batch", chunk.map((r: { id: string; email: string }, k: number) => build(r.id, r.email, liens[k])));
        const ids: string[] = (j?.data || []).map((x: { id: string }) => x.id);
        for (let k = 0; k < chunk.length; k++) {
          await supa.from("newsletter_recipients").update({ status: "envoye", provider_id: ids[k] || null, sent_at: new Date().toISOString() }).eq("id", chunk[k].id);
        }
        // Les invitations fabriquées pour ce lot sont parties : on l'inscrit,
        // comme le fait portal-invite, pour que l'écran Accès dise vrai.
        if (avecActivation) {
          await supa.from("portal_invites").update({ sent_at: new Date().toISOString() })
            .in("email", chunk.map((r: { email: string }) => r.email)).is("sent_at", null);
        }
        sent += chunk.length;
      } catch (e) {
        const msg = String((e as Error)?.message || e); errors.push(msg);
        if (QUOTA_RE.test(msg)) {
          // Plafond Resend atteint : ce lot et tous les suivants restent
          // « en_attente » (aucune tentative n'a réellement été envoyée pour
          // eux), pour repartir tout seuls au prochain essai — rien n'est
          // perdu, personne n'est sauté définitivement.
          quotaHit = true; quotaMsg = msg;
          break;
        }
        // Erreur non liée au quota (adresse invalide, domaine rejeté…) : celle-ci
        // ne se resoudra pas toute seule, on la marque donc comme definitive.
        erreurCount += chunk.length;
        for (const r of chunk) await supa.from("newsletter_recipients").update({ status: "erreur", error: msg.slice(0, 300) }).eq("id", r.id);
      }
      if (!quotaHit && i + 50 < list.length) await sleep(600);   // limite Resend : 2 requêtes / seconde
    }

    if (quotaHit) {
      const restants = list.length - sent - erreurCount;
      const message = `Quota d'envoi Resend atteint après ${sent}/${list.length} envois (${restants} en attente). ` +
        `Ils repartiront automatiquement en relançant l'envoi de cette newsletter une fois le quota renouvelé — ` +
        `ou augmente le plan Resend pour envoyer en une seule fois. Détail Resend : ${quotaMsg}`;
      // Repasse la newsletter en « erreur » (reprenable) plutôt que « envoyee » :
      // c'est exactement ce que fait newsletter_release_send, qui ne touche que
      // les newsletters encore au statut « envoi » (donc jamais une newsletter
      // deja terminee ou reprise par quelqu'un d'autre entre-temps).
      await asUser.rpc("newsletter_release_send", { p_id: n.id, p_erreur: message.slice(0, 500) });
      await supa.from("newsletters").update({ n_sent: sent }).eq("id", n.id);
      return json({ ok: true, partiel: true, quota: true, sent, restants, erreurs_definitives: erreurCount, message, activation: avecActivation ? bilan : undefined });
    }

    await supa.from("newsletters").update({ status: "envoyee", sent_at: new Date().toISOString(), sent_by: uid, n_sent: sent, last_error: errors.length ? errors.slice(0, 3).join(" | ").slice(0, 500) : null }).eq("id", n.id);
    return json({ ok: true, sent, errors: errors.length, desinscrits: purges || 0, activation: avecActivation ? bilan : undefined });
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
