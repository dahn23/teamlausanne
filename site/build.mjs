// ===========================================================================
//  build.mjs — fabrique une VRAIE page HTML par programme
// ---------------------------------------------------------------------------
// Tourne sur les serveurs de Netlify, jamais sur nos machines : ni Dan ni
// Raphael n'a Node installé, et c'est très bien ainsi — personne n'a à lancer
// quoi que ce soit à la main. `git push` suffit, comme avant.
//
// Ce qu'il fait : pour chacune des quatorze pages de contenu.js, il écrit
// <slug>/index.html — le gabarit du site, avec le bon titre, la bonne
// description, la bonne adresse canonique, les bonnes balises de partage, ses
// données structurées, et le contenu de la page déjà rendu en HTML.
//
// Pourquoi : une ancre (#kids) n'est jamais envoyée au serveur. Avant ce
// script, le site n'avait qu'UNE adresse indexable pour quatorze pages, et les
// robots qui n'exécutent pas de JavaScript n'en voyaient que 334 mots.
//
// Ce que ça ne change pas : le site reste la même application. index.js prend
// la main au chargement et remplace ce HTML par sa version interactive. Le
// visiteur voit exactement ce qu'il voyait, simplement plus tôt.
// ===========================================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTENU } from "./contenu.js";
import {
  pagesDe, corpsHTML, titreDe, descriptionDe, esc, faqDe, naviguerHTML,
  articleHTML, listeActusHTML, descriptionArticle,
} from "./rendu-statique.js";
import { SLUGS, urlDe } from "./adresses.js";

const ICI = dirname(fileURLToPath(import.meta.url));
const SITE = "https://teamlausanne.ch";
const IMAGE = SITE + "/assets/og-teamlausanne.jpg";

// Le gabarit, c'est index.html tel qu'il est dans le dépôt. On vérifie qu'il
// est vierge : si <main> contient déjà quelque chose, c'est qu'on relance le
// build sur une sortie précédente, et on s'arrête plutôt que d'empiler.
const MARQUE = '<main id="world-main" class="world-main"></main>';
const gabaritBrut = await readFile(join(ICI, "index.html"), "utf8");

// Les pages d'articles vivent à /actualites/<slug> : depuis cette adresse, un
// « style.css » relatif est cherché dans /actualites/style.css. C'est le
// défaut qui a servi des pages nues au premier déploiement, et il reviendrait
// ici d'un cran plus bas. On rend donc absolus, une fois pour toutes, les
// chemins du gabarit — ce qui ne change rien pour les pages à la racine.
const gabarit = gabaritBrut.replace(
  /(\s(?:href|src)=")(?!https?:|\/|#|mailto:|tel:|data:)([^"]*)"/g,
  (_, avant, chemin) => `${avant}/${chemin}"`);

if (!gabarit.includes(MARQUE)) {
  console.error("build: index.html n'est pas vierge (le <main> n'est pas vide).");
  console.error("build: relancer depuis une copie propre du dépôt.");
  process.exit(1);
}

// Remplacer une balise unique, en échouant bruyamment si elle a bougé. Un
// remplacement silencieusement raté donnerait quatorze pages au même titre,
// et personne ne le verrait avant des semaines.
function remplacer(html, motif, parQuoi, quoi) {
  if (!motif.test(html)) {
    console.error(`build: balise introuvable dans index.html — ${quoi}`);
    process.exit(1);
  }
  return html.replace(motif, parQuoi);
}

// Les données structurées propres à une page : le fil d'Ariane, et pour une
// filière le Course correspondant, rattaché à l'organisation déjà décrite
// dans index.html par son @id.
function jsonLdPage(cle, page, titre, description) {
  const url = urlDe(cle);
  const graphe = [
    {
      "@type": "WebPage",
      "@id": url + "#page",
      url, name: titre, description,
      inLanguage: "fr-CH",
      isPartOf: { "@id": SITE + "/#site" },
      about: { "@id": SITE + "/#academy" },
      primaryImageOfPage: IMAGE,
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: titreCourt(cle, page), item: url },
      ],
    },
  ];
  if (EST_UNE_FILIERE.has(cle)) {
    graphe.push({
      "@type": "Course",
      "@id": url + "#course",
      name: titreCourt(cle, page),
      description,
      url,
      inLanguage: "fr",
      provider: { "@id": SITE + "/#academy" },
      locationCreated: { "@id": SITE + "/#academy" },
    });
  }
  // Les questions-réponses de la page, telles qu'elles y sont affichées.
  // Google exige que la FAQ soit visible sur la page qui la déclare : c'est le
  // cas depuis que chaque filière a sa propre adresse, et pas avant.
  const faq = faqDe(page);
  if (faq.length) {
    graphe.push({
      "@type": "FAQPage",
      "@id": url + "#faq",
      mainEntity: faq.map(([q, r]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: r },
      })),
    });
  }
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graphe }, null, 2);
}

// Remplace l'image de partage (Open Graph + Twitter) par celle de la page.
// Les dimensions annoncées par le gabarit valent pour l'image par défaut, qui
// fait 1200x630 ; une photo de filière a d'autres proportions, et annoncer de
// fausses dimensions fait recadrer de travers. On les retire.
function imagePartage(html, url) {
  return html
    .replace(/<meta property="og:image" content="[^"]*"\s*\/>/, `<meta property="og:image" content="${esc(url)}" />`)
    .replace(/<meta property="og:image:width" content="[^"]*"\s*\/>\s*/, "")
    .replace(/<meta property="og:image:height" content="[^"]*"\s*\/>\s*/, "")
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/>/, `<meta name="twitter:image" content="${esc(url)}" />`);
}

const EST_UNE_FILIERE = new Set([
  "kids", "club-academy", "competition", "performance",
  "sport-etudes", "pro-u18", "pro", "adultes", "stages",
]);

const titreCourt = (cle, page) => page.title || page.slogan || cle;

// --- fabrication ----------------------------------------------------------
const pages = pagesDe(CONTENU);
const ecrites = [];

for (const [cle, page] of Object.entries(pages)) {
  if (!(cle in SLUGS)) {
    console.error(`build: pas d'adresse connue pour « ${cle} » — ajouter SLUGS dans rendu-statique.js.`);
    process.exit(1);
  }
  const slug = SLUGS[cle];
  const url = urlDe(cle);
  const titre = titreDe(cle, page);
  const description = descriptionDe(cle, page);
  const corps = corpsHTML(cle, page, pages);

  let html = gabarit;
  html = remplacer(html, /<title>[\s\S]*?<\/title>/, `<title>${esc(titre)}</title>`, "<title>");
  html = remplacer(html, /<meta name="description" content="[^"]*"\s*\/>/,
    `<meta name="description" content="${esc(description)}" />`, 'meta description');
  html = remplacer(html, /<link rel="canonical" href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${url}" />`, "canonical");
  html = remplacer(html, /<meta property="og:url" content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${url}" />`, "og:url");
  html = remplacer(html, /<meta property="og:title" content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${esc(titre)}" />`, "og:title");
  html = remplacer(html, /<meta property="og:description" content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${esc(description)}" />`, "og:description");
  html = html.replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/,
    `<meta name="twitter:title" content="${esc(titre)}" />`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/,
    `<meta name="twitter:description" content="${esc(description)}" />`);
  // L'image de partage : celle de la page, pas celle du site. Les quatorze
  // pages partageaient la même photo — un lien vers le Sport-études et un lien
  // vers Kids Tennis arrivaient avec la même vignette sur WhatsApp.
  html = imagePartage(html, page.hero ? SITE + "/" + page.hero.replace(/^\//, "") : IMAGE);

  // Les données structurées de la page viennent S'AJOUTER à celles du site
  // (organisation, lieu, programmes), qui restent dans le gabarit.
  html = html.replace("</head>",
    `  <script type="application/ld+json">\n${jsonLdPage(cle, page, titre, description)}\n  </script>\n</head>`);

  // Le contenu, déjà rendu. index.js le remplacera au chargement ; d'ici là
  // c'est ce que lisent les robots, et ce que voit un visiteur dont le
  // JavaScript n'a pas encore fini de charger.
  html = html.replace(MARQUE,
    `<main id="world-main" class="world-main" data-rendu-statique="${esc(cle)}">\n${corps}\n</main>`);

  // « sport-etudes.html » et NON « sport-etudes/index.html ».
  //
  // Ce détail a cassé le premier déploiement. Avec un dossier, Netlify
  // redirige /sport-etudes vers /sport-etudes/ — et à partir de cette adresse,
  // tous les chemins relatifs du gabarit glissent d'un cran : style.css est
  // cherché dans /sport-etudes/style.css, index.js dans /sport-etudes/index.js,
  // et les centaines de « assets/photos/… » de contenu.js avec eux. La page
  // s'affichait sans style ni JavaScript.
  //
  // Posé à plat, le fichier est servi à /sport-etudes, sans barre finale : les
  // chemins relatifs repartent donc de la racine, comme à l'accueil. En prime
  // l'adresse servie est exactement l'adresse canonique, sans redirection.
  await writeFile(join(ICI, slug ? slug + ".html" : "index.html"), html, "utf8");
  ecrites.push({ cle, adresse: "/" + slug, mots: corps.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length });
}

// --- les actualités -------------------------------------------------------
// Elles ne vivent pas dans contenu.js mais dans la base. On les lit au
// déploiement par news_public(), la fonction SECURITY DEFINER qui ne rend que
// les articles publiés et dont la date est arrivée — un brouillon ne peut donc
// pas fuiter, même en lisant la réponse réseau.
//
// Si la lecture échoue, on N'ARRÊTE PAS le build : un incident réseau chez
// Supabase ne doit pas empêcher de déployer une correction de CSS. On prévient
// bruyamment, les pages d'articles manquent pour ce déploiement, et le site
// continue de les rendre côté navigateur (voir la règle /actualites/* dans
// netlify.toml). Le prochain déploiement les rattrape.
const SUPABASE = "https://lnrmtwamuaqcubohontn.supabase.co";
const CLE_PUBLIABLE = "sb_publishable_nsRKXBFgwmDjtmvS3mFc0w_Q4pi_qxK";

async function lireActus() {
  try {
    const r = await fetch(`${SUPABASE}/rest/v1/rpc/news_public`, {
      method: "POST",
      headers: { apikey: CLE_PUBLIABLE, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  } catch (e) {
    console.warn("build: actualités illisibles (" + e.message + ") — pages d'articles non fabriquées.");
    console.warn("build: le site les rendra côté navigateur ; le prochain déploiement les rattrapera.");
    return null;
  }
}

const actus = await lireActus();
const actusEcrites = [];

if (actus) {
  const pageActu = (titre, description, url, corps, jsonld) => {
    let html = gabarit;
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(titre)}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*"\s*\/>/,
      `<meta name="description" content="${esc(description)}" />`);
    html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${url}" />`);
    html = html.replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${url}" />`);
    html = html.replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${esc(titre)}" />`);
    html = html.replace(/<meta property="og:description" content="[^"]*"\s*\/>/,
      `<meta property="og:description" content="${esc(description)}" />`);
    html = html.replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${esc(titre)}" />`);
    html = html.replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/,
      `<meta name="twitter:description" content="${esc(description)}" />`);
    if (jsonld) {
      html = html.replace("</head>", `  <script type="application/ld+json">\n${jsonld}\n  </script>\n</head>`);
    }
    return html.replace(MARQUE, `<main id="world-main" class="world-main" data-rendu-statique="actu">\n${corps}\n</main>`);
  };

  // Le même maillage que sur les pages de filière : un article ne doit pas
  // être un cul-de-sac pour un robot.
  const navCommune = naviguerHTML(null, pages);

  // La liste
  await writeFile(join(ICI, "actualites.html"), pageActu(
    "Actualités — Team Lausanne Academy",
    "La vie de l'académie, semaine après semaine : les stages, les tournois, les parcours de nos joueuses et joueurs, et les gens qui font le club.",
    SITE + "/actualites", listeActusHTML(actus) + navCommune,
    JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage",
      "@id": SITE + "/actualites#page", url: SITE + "/actualites", name: "Actualités",
      inLanguage: "fr-CH", isPartOf: { "@id": SITE + "/#site" },
      about: { "@id": SITE + "/#academy" } }, null, 2)), "utf8");

  // Un fichier par article, dans actualites/
  await mkdir(join(ICI, "actualites"), { recursive: true });
  for (const a of actus) {
    if (!a || !a.slug) continue;
    const url = `${SITE}/actualites/${a.slug}`;
    const description = descriptionArticle(a);
    const jsonld = JSON.stringify({
      "@context": "https://schema.org", "@type": "NewsArticle",
      "@id": url + "#article", mainEntityOfPage: url, url,
      headline: String(a.title || "").slice(0, 110),
      description, inLanguage: "fr-CH",
      datePublished: a.published_on, dateModified: a.published_on,
      articleSection: a.category || undefined,
      image: a.cover_url || IMAGE,
      author: { "@type": "Organization", name: a.author || "Team Lausanne Academy", url: SITE + "/" },
      publisher: { "@id": SITE + "/#academy" },
    }, null, 2);
    await writeFile(join(ICI, "actualites", a.slug + ".html"),
      pageActu(`${a.title} — Team Lausanne Academy`, description, url, articleHTML(a, navCommune), jsonld), "utf8");
    actusEcrites.push({ slug: a.slug, date: a.published_on });
  }
}

// --- la page 404 ----------------------------------------------------------
// Netlify en sert une par défaut : fond blanc, « Page Not Found », aucun lien.
// Le visiteur n'a plus qu'à fermer l'onglet. Celle-ci porte la barre du site
// et le chemin vers toutes les pages — une adresse périmée ramène donc dans
// le site au lieu d'en sortir. Netlify la sert automatiquement, avec le bon
// statut 404, dès qu'un fichier 404.html existe à la racine.
{
  const corps = `<article>
<h1>Cette page n'existe pas</h1>
<p>L'adresse demandée n'existe pas, ou n'existe plus. Voici par où reprendre.</p>
</article>
${naviguerHTML(null, pages)}`;
  let html = gabarit;
  html = html.replace(/<title>[\s\S]*?<\/title>/, "<title>Page introuvable — Team Lausanne Academy</title>");
  html = html.replace(/<meta name="description" content="[^"]*"\s*\/>/,
    '<meta name="description" content="Cette page n\'existe pas. Retrouvez les programmes, les stages et les actualités de Team Lausanne Academy." />');
  // Pas d'adresse canonique sur une 404, et surtout pas d'indexation : cette
  // page peut être servie sous mille adresses différentes.
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/>/,
    '<meta name="robots" content="noindex" />');
  html = html.replace(MARQUE, `<main id="world-main" class="world-main" data-rendu-statique="404">\n${corps}\n</main>`);
  await writeFile(join(ICI, "404.html"), html, "utf8");
}

// --- le plan du site ------------------------------------------------------
// Généré depuis la même liste : impossible qu'il annonce une page qui
// n'existe pas, ou qu'il en oublie une.
const aujourdhui = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Généré par build.mjs à chaque déploiement. Ne pas éditer à la main. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Object.keys(pages).map((cle) => `  <url>
    <loc>${urlDe(cle)}</loc>
    <lastmod>${aujourdhui}</lastmod>
    <changefreq>${cle === "academie" ? "weekly" : "monthly"}</changefreq>
    <priority>${cle === "academie" ? "1.0" : "0.8"}</priority>
  </url>`).join("\n")}
${actus ? `  <url>
    <loc>${SITE}/actualites</loc>
    <lastmod>${aujourdhui}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
${actusEcrites.map((a) => `  <url>
    <loc>${SITE}/actualites/${a.slug}</loc>
    <lastmod>${a.date || aujourdhui}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>`).join("\n")}` : ""}
${["samedi-famille", "tennis-lunchs", "confidentialite"].map((s) => `  <url>
    <loc>${SITE}/${s}</loc>
    <changefreq>yearly</changefreq>
    <priority>0.4</priority>
  </url>`).join("\n")}
</urlset>
`;
await writeFile(join(ICI, "sitemap.xml"), sitemap, "utf8");

console.log(`build: ${ecrites.length} pages écrites`);
for (const e of ecrites) console.log(`  ${e.adresse.padEnd(24)} ${String(e.mots).padStart(5)} mots`);
console.log(`build: ${actus ? actusEcrites.length + " articles" : "actualités NON fabriquées"}`);
console.log(`build: sitemap.xml — ${Object.keys(pages).length + 3 + (actus ? actusEcrites.length + 1 : 0)} adresses`);
