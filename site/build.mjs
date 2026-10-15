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
  pagesDe, corpsHTML, titreDe, descriptionDe, SLUGS, urlDe, esc,
} from "./rendu-statique.js";

const ICI = dirname(fileURLToPath(import.meta.url));
const SITE = "https://teamlausanne.ch";
const IMAGE = SITE + "/assets/og-teamlausanne.jpg";

// Le gabarit, c'est index.html tel qu'il est dans le dépôt. On vérifie qu'il
// est vierge : si <main> contient déjà quelque chose, c'est qu'on relance le
// build sur une sortie précédente, et on s'arrête plutôt que d'empiler.
const MARQUE = '<main id="world-main" class="world-main"></main>';
const gabarit = await readFile(join(ICI, "index.html"), "utf8");
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
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graphe }, null, 2);
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
  const corps = corpsHTML(cle, page);

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

  // Les données structurées de la page viennent S'AJOUTER à celles du site
  // (organisation, lieu, programmes), qui restent dans le gabarit.
  html = html.replace("</head>",
    `  <script type="application/ld+json">\n${jsonLdPage(cle, page, titre, description)}\n  </script>\n</head>`);

  // Le contenu, déjà rendu. index.js le remplacera au chargement ; d'ici là
  // c'est ce que lisent les robots, et ce que voit un visiteur dont le
  // JavaScript n'a pas encore fini de charger.
  html = html.replace(MARQUE,
    `<main id="world-main" class="world-main" data-rendu-statique="${esc(cle)}">\n${corps}\n</main>`);

  const dossier = slug ? join(ICI, slug) : ICI;
  if (slug) await mkdir(dossier, { recursive: true });
  await writeFile(join(dossier, "index.html"), html, "utf8");
  ecrites.push({ cle, adresse: "/" + slug, mots: corps.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length });
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
console.log(`build: sitemap.xml — ${Object.keys(pages).length + 3} adresses`);
