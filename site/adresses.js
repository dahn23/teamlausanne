// ===========================================================================
//  adresses.js — la table des adresses, et rien d'autre
// ---------------------------------------------------------------------------
// Trois programmes lisent cette liste :
//   · build.mjs     — pour savoir quel fichier écrire ;
//   · index.js      — pour relier les pages entre elles dans le navigateur ;
//   · rendu-statique.js — pour réécrire les liens #ancre en vrais chemins.
//
// Elle vit seule dans son fichier pour que le navigateur n'ait pas à
// télécharger tout le moteur de rendu statique — dont il ne se sert jamais —
// simplement pour connaître l'adresse de la page Kids Tennis.
//
// La clé est celle de contenu.js, la valeur l'adresse publique. On ne reprend
// pas la clé telle quelle : « club-academy » et « coaches » sont des noms de
// code, pas des adresses qu'on lit ou qu'on dicte au téléphone.
//
// ⚠️ Changer une adresse ici, c'est casser les liens déjà partagés. Si cela
// devient nécessaire, ajouter une redirection 301 dans netlify.toml, de
// l'ancienne vers la nouvelle.
// ===========================================================================

export const SLUGS = {
  academie: "",                       // la racine
  tournoi: "lausanne-open",
  "journee-team-lausanne": "journee-team-lausanne",
  stages: "stages",
  "sport-etudes": "sport-etudes",
  competition: "competition",
  performance: "performance",
  "pro-u18": "pro-u18",
  pro: "pro",
  kids: "kids-tennis",
  "club-academy": "club",
  adultes: "cours-adultes",
  gamezone: "gamezone",
  coaches: "nos-coachs",
};

// ---------------------------------------------------------------------------
//  La version anglaise, sous /en/ (25.11.2026)
// ---------------------------------------------------------------------------
// Des adresses TRADUITES, pas /en/cours-adultes : une adresse se lit, se
// dicte au téléphone et se partage. Un visiteur anglophone qui voit
// « /en/adult-tennis » sait où il est avant d'avoir ouvert la page, et Google
// lit le mot-clé dans l'adresse comme il lit celui de la version française.
//
// ⚠️ Un nom qui ne se traduit pas ne se traduit pas : « Lausanne Open »,
// « GameZone », « pro », « performance » et « competition » s'écrivent pareil
// dans les deux langues. Les forcer donnerait des adresses inventées, que
// personne ne cherche.
//
// ⚠️ « sport-etudes » devient « sport-studies », et le texte anglais dit
// « Sport Studies » — décision du 25.11.2026. En revanche « maturité » et
// « interclub » restent en français dans le texte : ce sont des diplômes et
// un format de championnat suisses, et les traduire désignerait autre chose.
// Voir l'entête de contenu-en.js, qui tient la liste.
export const SLUGS_EN = {
  academie: "",                       // la racine anglaise, soit /en
  tournoi: "lausanne-open",
  "journee-team-lausanne": "team-lausanne-day",
  stages: "camps",
  "sport-etudes": "sport-studies",
  competition: "competition",
  performance: "performance",
  "pro-u18": "pro-u18",
  pro: "pro",
  kids: "kids-tennis",
  "club-academy": "club",
  adultes: "adult-tennis",
  gamezone: "gamezone",
  coaches: "our-coaches",
};

export const LANGUES = ["fr", "en"];
export const LANGUE_PAR_DEFAUT = "fr";

// Le préfixe de chemin d'une langue : rien pour le français (le site EST en
// français à la racine), « en » pour l'anglais.
export const PREFIXE = { fr: "", en: "en" };

export const slugsDe = (lang) => (lang === "en" ? SLUGS_EN : SLUGS);

// L'inverse, pour que le routeur retrouve la clé depuis l'adresse.
const inverse = (table) => Object.fromEntries(
  Object.entries(table).filter(([, s]) => s).map(([c, s]) => [s, c]));

export const CLE_DE_SLUG = inverse(SLUGS);
export const CLE_DE_SLUG_EN = inverse(SLUGS_EN);
export const cleDeSlugDe = (lang) => (lang === "en" ? CLE_DE_SLUG_EN : CLE_DE_SLUG);

export const SITE = "https://teamlausanne.ch";

// Le chemin d'une page, sans le domaine : « /en/kids-tennis », « /stages »,
// « / » pour l'accueil français et « /en » pour l'accueil anglais.
// ⚠ Jamais de barre finale : les pages sont posées à plat (kids-tennis.html,
// en/kids-tennis.html) précisément pour qu'une adresse sans barre soit servie
// telle quelle. Voir le commentaire de build.mjs, qui a coûté un déploiement.
// ---------------------------------------------------------------------------
//  La traduction avance page par page : un lien ne doit jamais tomber dans le
//  vide pendant ce temps.
// ---------------------------------------------------------------------------
// La liste des pages qui EXISTENT en anglais est déclarée une fois, au
// démarrage, par build.mjs et par index.js. Tant qu'une page n'y est pas, un
// lien anglais vers elle renvoie vers la page FRANÇAISE — qui, elle, est
// complète. Le visiteur change de langue en cours de route, ce qui n'est pas
// idéal ; il ne tombe pas sur un 404, ce qui serait pire.
//
// ⚠ C'est un état de module, et c'est assumé : « quelles pages existent en
// anglais » ne change pas d'une page à l'autre, c'est vrai pour toute la
// durée d'un build ou d'une visite. À ne pas étendre à autre chose.
let DISPO_EN = null;
export const declarerPagesEN = (cles) => { DISPO_EN = new Set(cles || []); };
export const pageExisteEn = (cle, lang) =>
  lang !== "en" || !DISPO_EN || DISPO_EN.has(cle);

export function cheminDe(cle, lang = LANGUE_PAR_DEFAUT) {
  if (lang === "en" && !pageExisteEn(cle, "en")) return cheminDe(cle, "fr");
  const slug = slugsDe(lang)[cle] || "";
  const pre = PREFIXE[lang] || "";
  if (!pre) return "/" + slug;
  // ⚠ L'accueil anglais s'écrit « /en/ », AVEC la barre. C'est le seul endroit :
  // le fichier est en/index.html, et Netlify renvoie /en vers /en/. Annoncer
  // « /en » en canonique ferait pointer l'adresse canonique sur une
  // redirection — Google suit, mais le signale comme un défaut.
  return slug ? "/" + pre + "/" + slug : "/" + pre + "/";
}

export const urlDe = (cle, lang = LANGUE_PAR_DEFAUT) => SITE + cheminDe(cle, lang);

// La langue d'un chemin, et le chemin débarrassé de son préfixe. Sert au
// routeur du navigateur comme au build.
export function langueDuChemin(pathname) {
  const net = String(pathname || "").replace(/^\/+|\/+$/g, "");
  if (net === "en" || net.startsWith("en/")) {
    return { lang: "en", reste: net.slice(2).replace(/^\/+/, "") };
  }
  return { lang: "fr", reste: net };
}

// L'adresse de LA MÊME page dans l'autre langue — ce que le sélecteur
// FR | EN doit viser. Rend null si la page n'existe pas dans cette langue :
// le sélecteur se cache alors plutôt que de promettre une page absente.
export function versLangue(cle, lang) {
  if (!(cle in slugsDe(lang))) return null;
  if (lang === "en" && !pageExisteEn(cle, "en")) return null;   // pas encore traduite
  // ⚠ On repasse par cheminDe pour ne pas réécrire la règle de la barre
  // finale de /en/ : elle existait en double, et les deux copies avaient
  // divergé le jour même — le sélecteur pointait « /en », le canonique
  // « /en/ », et Netlify ajoutait une redirection entre les deux.
  const prov = pageExisteEn(cle, lang);
  if (!prov) return null;
  return cheminDe(cle, lang);
}
