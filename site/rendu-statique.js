// ===========================================================================
//  rendu-statique.js — le site, rendu en HTML AVANT d'arriver au navigateur
// ---------------------------------------------------------------------------
// Pourquoi ce fichier existe.
//
// Le site route par #ancre. Une ancre n'est jamais envoyée au serveur : pour
// un moteur, teamlausanne.ch/#kids et teamlausanne.ch sont la même adresse. Il
// n'y avait donc qu'UNE page indexable pour quatorze pages de contenu, et les
// robots des moteurs de réponse — qui, eux, n'exécutent pas de JavaScript —
// n'en voyaient que 334 mots.
//
// Ce module relit contenu.js, la même source que index.js, et en fait du HTML
// sémantique : un titre, des intertitres, des paragraphes, des listes. Rien
// d'interactif, rien de joli — c'est la version que lisent les robots et celle
// qui s'affiche le temps que index.js prenne le relais.
//
// Il est volontairement SANS DÉPENDANCE et sans API de navigateur ni de Node :
// la même fonction tourne dans build.mjs (qui écrit les fichiers) et dans le
// navigateur (où l'on peut donc la tester sans rien déployer).
//
// Règle de fond : ce module n'invente rien. Il ne sait pas écrire une phrase,
// il ne sait que déplacer celles de contenu.js. Si une section n'est pas
// reconnue, elle tombe dans le ramasse-miettes générique plus bas — qui en
// extrait le texte quand même, plutôt que de la perdre en silence.
// ===========================================================================

export const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

// Les adresses des pages. La clé est celle de contenu.js, la valeur l'adresse
// publique. On ne se contente pas de reprendre la clé : « club-academy » et
// « coaches » sont des noms de code, pas des adresses qu'on lit.
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

// L'inverse, pour que le routeur retrouve la clé depuis l'adresse.
export const CLE_DE_SLUG = Object.fromEntries(
  Object.entries(SLUGS).filter(([, s]) => s).map(([c, s]) => [s, c]));

const SITE = "https://teamlausanne.ch";
export const urlDe = (cle) => SITE + "/" + (SLUGS[cle] || "");

// --- petits assembleurs ---------------------------------------------------
const p = (t) => (t ? `<p>${esc(t)}</p>` : "");
const h = (n, t) => (t ? `<h${n}>${esc(t)}</h${n}>` : "");
const ul = (items) => (items && items.length
  ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");

// Une valeur « texte » peut arriver sous plusieurs formes dans contenu.js :
// une chaîne, un tableau de chaînes (paragraphes), ou un tableau de paires.
const texteDe = (v) => {
  if (v == null) return "";
  if (typeof v === "string") return p(v);
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? p(x) : "")).join("");
  return "";
};

// Une entrée de liste peut être une chaîne, une paire [question, réponse], ou
// un objet { name/title/label, quoi/text/desc/meta }. On rend ce qu'on trouve.
const ligneDe = (it) => {
  if (it == null) return "";
  if (typeof it === "string") return `<li>${esc(it)}</li>`;
  if (Array.isArray(it)) {
    const [a, b] = it;
    return `<li><strong>${esc(a)}</strong>${b ? ` — ${esc(b)}` : ""}</li>`;
  }
  const nom = it.name || it.title || it.label || it.h || it.nom || "";
  const txt = it.quoi || it.text || it.desc || it.body || it.meta || it.t || it.age || "";
  if (!nom && !txt) return "";
  return `<li>${nom ? `<strong>${esc(nom)}</strong>` : ""}${
    nom && txt ? " — " : ""}${txt ? esc(txt) : ""}</li>`;
};

// --- le ramasse-miettes ---------------------------------------------------
// Toute section non reconnue passe ici. On n'essaie pas de deviner sa mise en
// page : on sort son titre, ses phrases et ses listes. Mieux vaut un bloc
// simple qu'un bloc manquant — c'est du texte que les moteurs doivent lire.
function sectionGenerique(sec) {
  const out = [];
  out.push(h(2, sec.title || sec.label));
  out.push(texteDe(sec.lead || sec.sub || sec.subtitle || sec.body || sec.note));
  if (Array.isArray(sec.items) && sec.items.length) {
    out.push(`<ul>${sec.items.map(ligneDe).join("")}</ul>`);
  }
  return out.join("");
}

// --- sections à forme connue ----------------------------------------------
function sectionConnue(sec) {
  switch (sec.type) {
    // Une question, une réponse : c'est le format que les moteurs de réponse
    // citent le plus volontiers. On le rend en vraie liste de définitions.
    case "faq":
      return h(2, sec.title) + (Array.isArray(sec.items)
        ? `<dl>${sec.items.map((it) => Array.isArray(it)
            ? `<dt>${esc(it[0])}</dt><dd>${esc(it[1])}</dd>` : "").join("")}</dl>` : "");

    case "rich":
      return h(2, sec.title) + texteDe(sec.body);

    case "split":
      return h(2, sec.title) + texteDe(sec.lead || sec.body)
        + (Array.isArray(sec.points) ? ul(sec.points) : "");

    case "progmap":
      return h(2, sec.title) + p(sec.sub) + (sec.groupes || []).map((g) =>
        h(3, g.titre) + p(g.pour) + `<ul>${(g.items || []).map((o) =>
          `<li><a href="${esc(lienDe(o.href))}"><strong>${esc(o.name)}</strong></a>${
            o.age ? ` (${esc(o.age)})` : ""}${o.quoi ? ` — ${esc(o.quoi)}` : ""}</li>`
        ).join("")}</ul>`).join("") + p(sec.note);

    case "pyramid":
      return h(2, sec.title) + p(sec.sub || sec.lead) + p(sec.note);

    case "keywords":
      return (sec.label ? h(2, sec.label) : "")
        + ul((sec.items || []).map((x) => (typeof x === "string" ? x : x && x.t)).filter(Boolean));

    case "coachs":
      return h(2, sec.title) + p(sec.eyebrow)
        + `<ul>${(sec.items || []).map((c) =>
            `<li><strong>${esc(c.nom || c.name)}</strong>${
              c.role ? ` — ${esc(c.role)}` : ""}</li>`).join("")}</ul>`;

    case "telecharger":
      return h(2, sec.title) + p(sec.lead) + ul(sec.points || [])
        + (sec.href ? `<p><a href="${esc(sec.href)}" download>${
            esc(sec.bouton || "Télécharger")}</a></p>` : "");

    case "mention":
      return h(2, sec.title) + texteDe(sec.body);

    default:
      return null;      // → ramasse-miettes
  }
}

// Un href de contenu.js est encore en #ancre. Dans la page statique, il doit
// pointer la VRAIE adresse, sans quoi on servirait à un robot des liens qui
// ne mènent nulle part et on perdrait tout le maillage interne.
export function lienDe(href) {
  if (!href) return "/";
  if (!href.startsWith("#")) return href;
  const cle = href.slice(1);
  return cle in SLUGS ? "/" + SLUGS[cle] : href;
}

export function sectionHTML(sec) {
  if (!sec || typeof sec !== "object") return "";
  const connu = sectionConnue(sec);
  const html = connu === null ? sectionGenerique(sec) : connu;
  return html ? `<section>${html}</section>` : "";
}

// --- la page --------------------------------------------------------------
// `page` est un monde (academie, tournoi) ou une fiche (kids, stages…). Les
// deux n'ont pas les mêmes champs de tête : un monde porte slogan/desc, une
// fiche porte title/subtitle. On normalise ici, une fois.
export function enTeteDe(cle, page) {
  const titre = page.title || page.slogan || "";
  const chapo = page.subtitle || page.desc || "";
  return { titre, chapo };
}

export function corpsHTML(cle, page) {
  const { titre, chapo } = enTeteDe(cle, page);
  const sections = (page.sections || []).map(sectionHTML).join("\n");
  return `<article>\n${h(1, titre)}\n${p(chapo)}\n${sections}\n</article>`;
}

// --- métadonnées ----------------------------------------------------------
// La description vient du site, jamais d'une phrase inventée ici. Coupée à
// 155 signes sur une frontière de mot : au-delà Google tronque, et une
// description coupée au milieu d'un mot a l'air cassée.
export function descriptionDe(cle, page) {
  const { chapo } = enTeteDe(cle, page);
  const brut = (chapo || "").replace(/\s+/g, " ").trim();
  if (brut.length <= 155) return brut;
  const coupe = brut.slice(0, 155);
  return coupe.slice(0, coupe.lastIndexOf(" ")).replace(/[ ,;:]+$/, "") + "…";
}

// « Sport-études — Team Lausanne Academy », et pour la racine le titre large
// qui vise la requête qu'on tape vraiment.
export function titreDe(cle, page) {
  if (cle === "academie") return "École de tennis à Lausanne — Team Lausanne Academy";
  const { titre } = enTeteDe(cle, page);
  const base = titre || cle;
  const suffixe = " — Team Lausanne Academy";
  return (base.length + suffixe.length > 62 ? base : base + suffixe);
}
