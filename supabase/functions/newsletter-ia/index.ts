// newsletter-ia — propose une mise en page complète de newsletter à partir
// d'une description en langage courant. Le staff relit et retouche ensuite
// bloc par bloc : on rend un BROUILLON, jamais un envoi.
//
// Deux partis pris qui tiennent tout le reste :
//
//  1. L'IA écrit le CONTENU et la STRUCTURE, pas le style. Elle ne choisit ni
//     couleur, ni police, ni taille, ni logo : la console fusionne chaque bloc
//     rendu avec le gabarit maison (NL_MODELES). La charte est donc respectée
//     par construction, et il y a beaucoup moins de champs où se tromper.
//
//  2. Tout ce qui revient est REVALIDÉ ici. Un type inconnu est jeté, les
//     champs en trop sont ignorés, et le HTML des blocs de texte passe par une
//     liste blanche de balises. Ce HTML finit dans un e-mail ET dans
//     l'innerHTML de l'éditeur : le laisser passer tel quel reviendrait à
//     exécuter ce qu'un modèle a écrit.
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
const MAX_BLOCS = 24;

// Balises tolérées dans un bloc de texte. Volontairement courte : une
// newsletter n'a pas besoin de plus, et chaque balise en plus est une surface
// de plus. Tout le reste est retiré, contenu conservé.
const BALISES_OK = new Set(["b", "strong", "i", "em", "u", "br", "p", "div", "span", "ul", "ol", "li", "a"]);

function nettoyerHtml(src: string): string {
  let h = String(src || "");
  // D'abord les éléments dont le CONTENU doit disparaître aussi.
  h = h.replace(/<(script|style|iframe|object|embed|form|svg)[\s\S]*?<\/\1>/gi, "");
  h = h.replace(/<(script|style|iframe|object|embed|form|svg)\b[^>]*\/?>/gi, "");
  // Puis les balises hors liste blanche : on garde le texte, on jette l'enveloppe.
  h = h.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (bal, nom: string, attrs: string) => {
    if (!BALISES_OK.has(nom.toLowerCase())) return "";
    if (bal.startsWith("</")) return `</${nom.toLowerCase()}>`;
    // Un lien garde son href s'il est http(s) ou mailto ; tout autre attribut
    // saute — c'est là que vivent les on* et les javascript:.
    if (nom.toLowerCase() === "a") {
      const m = attrs.match(/href\s*=\s*"([^"]*)"/i) || attrs.match(/href\s*=\s*'([^']*)'/i);
      const href = (m?.[1] || "").trim();
      return /^(https?:\/\/|mailto:)/i.test(href) ? `<a href="${href.replace(/"/g, "&quot;")}">` : "<a>";
    }
    return `<${nom.toLowerCase()}>`;
  });
  return h.trim();
}

const txt = (v: unknown, n = 300) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const lien = (v: unknown) => {
  const u = String(v ?? "").trim();
  return /^(https?:\/\/|mailto:)/i.test(u) ? u.slice(0, 400) : "";
};

// Ne laisse passer que ce que l'éditeur sait relire, champ par champ.
function validerBlocs(brut: unknown): Record<string, unknown>[] {
  if (!Array.isArray(brut)) return [];
  const out: Record<string, unknown>[] = [];
  for (const b of brut.slice(0, MAX_BLOCS)) {
    const t = String((b as Record<string, unknown>)?.t || "");
    const o = (b ?? {}) as Record<string, unknown>;
    const align = ["left", "center", "right"].includes(String(o.align)) ? String(o.align) : undefined;
    switch (t) {
      case "entete": out.push({ t }); break;
      case "sep":    out.push({ t }); break;
      case "espace": out.push({ t, h: Math.min(80, Math.max(8, Number(o.h) || 24)) }); break;
      case "pied":   out.push({ t }); break;   // l'adresse vient du gabarit, pas du modèle
      case "titre":
        if (txt(o.texte, 140)) out.push({ t, texte: txt(o.texte, 140), ...(align ? { align } : {}) });
        break;
      case "texte": {
        const html = nettoyerHtml(String(o.html ?? "")).slice(0, 4000);
        if (html) out.push({ t, html, ...(align ? { align } : {}) });
        break;
      }
      case "bouton": {
        const l = lien(o.href);
        if (txt(o.texte, 60) && l) out.push({ t, texte: txt(o.texte, 60), href: l, ...(align ? { align } : {}) });
        break;
      }
      case "image":
        // src volontairement vide : le modèle n'a aucune image à proposer.
        // L'alt sert de consigne — « mets une photo de … » — et le bloc
        // attend dans l'éditeur qu'on lui en donne une.
        out.push({ t, src: "", alt: txt(o.alt, 120) });
        break;
      case "duo": {
        const html = nettoyerHtml(String(o.html ?? "")).slice(0, 2000);
        if (html) out.push({ t, src: "", alt: txt(o.alt, 120), html,
          sens: o.sens === "image-droite" ? "image-droite" : "image-gauche" });
        break;
      }
      case "bandeau":
        if (txt(o.texte, 80)) out.push({ t, texte: txt(o.texte, 80), sous: txt(o.sous, 120) });
        break;
      case "chiffres": {
        const items = (Array.isArray(o.items) ? o.items : []).slice(0, 4)
          .map((x) => ({ n: txt((x as Record<string, unknown>)?.n, 12), l: txt((x as Record<string, unknown>)?.l, 40) }))
          .filter((x) => x.n || x.l);
        if (items.length) out.push({ t, items });
        break;
      }
      default: break;   // type inconnu : jeté sans bruit
    }
  }
  return out;
}

const CONSIGNE = `Tu prépares une newsletter pour Team Lausanne Academy, une académie de tennis à Lausanne (Suisse romande).

Tu rends UNIQUEMENT un objet JSON, sans texte autour, de la forme :
{"subject": "...", "blocs": [ ... ]}

"subject" : l'objet de l'e-mail. Court, concret, sans point final, sans emoji.

"blocs" : la mise en page, dans l'ordre. Types disponibles et champs AUTORISÉS
(n'en invente aucun autre, ne mets ni couleur ni taille ni police — la charte
est appliquée ensuite automatiquement) :

  {"t":"entete"}                                  bandeau logo. Toujours en premier.
  {"t":"titre","texte":"…","align":"left"}        titre de section
  {"t":"texte","html":"…","align":"left"}         paragraphe. HTML simple admis :
                                                  <b> <i> <br> <p> <ul> <li> <a href="…">
  {"t":"image","alt":"ce qu'il faut mettre"}      emplacement photo. Tu ne fournis PAS
                                                  l'image : décris-la dans "alt".
  {"t":"duo","html":"…","alt":"…","sens":"image-gauche"}  image + texte côte à côte
  {"t":"bouton","texte":"…","href":"https://…"}   appel à l'action
  {"t":"bandeau","texte":"…","sous":"…"}          bande colorée : un prix, une date
  {"t":"chiffres","items":[{"n":"35","l":"semaines"}]}    2 à 4 chiffres clés
  {"t":"sep"}                                     filet de séparation
  {"t":"espace","h":24}                           respiration
  {"t":"pied"}                                    coordonnées. Toujours en dernier.

RÈGLES :
- Commence par {"t":"entete"} et termine par {"t":"pied"}.
- 8 à 16 blocs. Alterne les types : un mur de paragraphes n'est pas une mise en page.
- Écris en français, vouvoiement, ton chaleureux mais sobre. Pas d'emoji.
- Du concret : des dates, des heures, des prix, des noms. Si la description ne
  les donne pas, écris un marqueur explicite entre crochets — [date à confirmer],
  [prix] — pour que la personne sache quoi compléter. N'invente jamais un fait.
- Les liens : uniquement https://teamlausanne.ch ou mailto:info@teamlausanne.ch,
  sauf si la description en fournit d'autres.
- Un seul bouton principal, deux au maximum.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!Deno.env.get("ANTHROPIC_API_KEY")) {
      return json({ error: "Clé ANTHROPIC_API_KEY absente des secrets Supabase." }, 400);
    }
    const asUser = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: ures } = await asUser.auth.getUser();
    const uid = ures?.user?.id;
    if (!uid) return json({ error: "Non authentifié." }, 401);
    const supa = createClient(url, service);
    const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", uid);
    if (!(roles || []).some((r: { role: string }) => STAFF.includes(r.role))) {
      return json({ error: "Accès réservé (admin / secrétariat)." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const brief = txt(body?.brief, 4000);
    if (brief.length < 10) return json({ error: "Décris en une ou deux phrases ce que tu veux annoncer." }, 400);

    const client = new Anthropic();
    let reponse;
    try {
      reponse = await client.messages.create({
        model: "claude-opus-5",
        max_tokens: 8000,
        system: CONSIGNE,
        messages: [{ role: "user", content: `Voici ce qu'il faut annoncer :\n\n${brief}` }],
      }, { fallbacks: [{ model: "claude-opus-4-8" }] } as Record<string, unknown>);
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) return json({ error: "IA : clé ANTHROPIC_API_KEY invalide." }, 500);
      throw e;
    }

    const sortie = (reponse.content || [])
      .filter((c: { type: string }) => c.type === "text")
      .map((c: { text: string }) => c.text).join("\n").trim();
    // Le modèle encadre parfois le JSON d'une clôture markdown : on prend le
    // premier objet accolade à accolade plutôt que d'exiger une sortie nue.
    const debut = sortie.indexOf("{"), fin = sortie.lastIndexOf("}");
    if (debut < 0 || fin <= debut) return json({ error: "Réponse illisible de l'IA. Réessaie." }, 502);
    let brut: Record<string, unknown>;
    try { brut = JSON.parse(sortie.slice(debut, fin + 1)); }
    catch { return json({ error: "Réponse illisible de l'IA. Réessaie." }, 502); }

    const blocs = validerBlocs(brut.blocs);
    if (!blocs.length) return json({ error: "L'IA n'a rien produit d'exploitable. Reformule la description." }, 502);

    return json({
      ok: true,
      subject: txt(brut.subject, 160),
      blocs,
      modele: reponse.model,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
