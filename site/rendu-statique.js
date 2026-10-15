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

// La table des adresses vit dans adresses.js : le navigateur la lit aussi, et
// n'a pas à télécharger ce moteur de rendu pour connaître un chemin.
export { SLUGS, CLE_DE_SLUG, urlDe } from "./adresses.js";
import { SLUGS } from "./adresses.js";

// contenu.js porte deux renvois, en texte, que index.js résout avant de
// rendre : "@coachs" devient la liste des coachs, { type:"mention" } sans
// titre devient la mention « droit à l'image ». Le build DOIT faire le même
// travail — sinon il essaie de parcourir la chaîne "@coachs" comme un tableau,
// et la page entière se perd. C'est exactement ce qui s'est produit au premier
// essai. Même logique qu'index.js, reproduite ici parce que ce module ne doit
// dépendre de rien.
export function resoudre(o, CONTENU) {
  const renvois = {
    "@coachs": () => CONTENU.coachs,
    "@flag_ch": () => CONTENU.flag_ch,
    "@flag_ie": () => CONTENU.flag_ie,
    "@flag_fr": () => CONTENU.flag_fr,
    "@itf_url": () => CONTENU.itf_url,
    "@gamezone_url": () => CONTENU.gamezone_url,
  };
  const pas = (x) => {
    if (typeof x === "string") return renvois[x] ? renvois[x]() : x;
    if (Array.isArray(x)) return x.map(pas);
    if (x && typeof x === "object") {
      if (x.type === "mention" && !x.title) return { ...CONTENU.mention_image };
      const r = {};
      for (const [k, v] of Object.entries(x)) r[k] = pas(v);
      return r;
    }
    return x;
  };
  return pas(o);
}

// Toutes les pages du site, clés résolues, prêtes à rendre.
export const pagesDe = (CONTENU) => ({
  ...resoudre(CONTENU.worlds, CONTENU),
  ...resoudre(CONTENU.details, CONTENU),
});

// Un tableau, ou rien. Une section mal formée ne doit pas faire tomber la
// page entière au build : on préfère un bloc vide à un site qui ne compile pas.
const tab = (v) => (Array.isArray(v) ? v : []);

// Quelques valeurs de contenu.js portent un peu de gras (« <b>−20 %</b> »).
// On retire les balises AVANT d'échapper : sinon la page statique afficherait
// « &lt;b&gt;−20 %&lt;/b&gt; ». Retirer puis échapper, dans cet ordre, ne
// laisse jamais passer de balise.
const sansBalises = (s) => (typeof s === "string" ? s.replace(/<[^>]*>/g, "") : s);

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
      return h(2, sec.title) + p(sec.sub) + tab(sec.groupes).map((g) =>
        h(3, g.titre) + p(g.pour) + `<ul>${tab(g.items).map((o) =>
          `<li><a href="${esc(lienDe(o.href))}"><strong>${esc(o.name)}</strong></a>${
            o.age ? ` (${esc(o.age)})` : ""}${o.quoi ? ` — ${esc(o.quoi)}` : ""}</li>`
        ).join("")}</ul>`).join("") + p(sec.note);

    case "pyramid":
      return h(2, sec.title) + p(sec.sub || sec.lead) + p(sec.note);

    case "keywords":
      return (sec.label ? h(2, sec.label) : "")
        + ul(tab(sec.items).map((x) => (typeof x === "string" ? x : x && x.t)).filter(Boolean));

    // Chaque coach a un résumé et une vraie biographie. Les laisser de côté
    // revenait à publier une page « Nos coachs » de cent mots alors que le
    // site en contient des centaines — et ce sont des mots que personne
    // d'autre n'a écrits, donc exactement ceux qui méritent d'être lus.
    case "coachs":
      return h(2, sec.title) + p(sec.eyebrow)
        + tab(sec.items).map((c) => {
            const nom = c.nom || c.name || "";
            if (!nom) return "";
            return h(3, nom) + (c.role ? p(c.role) : "") + p(c.resume)
              + texteDe(c.bio)
              + (Array.isArray(c.tags) && c.tags.length ? ul(c.tags) : "");
          }).join("");

    // Les formules de stage : âge, horaire, contenu, prix. C'est la réponse à
    // « combien coûte un stage de tennis à Lausanne », et elle était jusqu'ici
    // invisible. Chaque formule devient un bloc à part entière.
    case "formules":
      return h(2, sec.title) + p(sansBalises(sec.intro))
        + tab(sec.items).map((f) => {
            if (!f || !f.name) return "";
            const infos = [f.age, f.rythme, f.horaire, f.price].filter(Boolean);
            return h(3, f.name) + (infos.length ? p(infos.join(" · ")) : "")
              + ul(tab(f.lines));
          }).join("");

    case "telecharger":
      return h(2, sec.title) + p(sec.lead) + ul(tab(sec.points))
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
  // Une fiche porte un `title` ; un monde n'a qu'un `slogan` et un `tag`. Le
  // slogan ne fait pas un titre : celui du tournoi donnait « Vibrer. Rêver.
  // Ensemble. », sous quoi personne ne cherchera jamais le Lausanne Open. Le
  // `tag` d'un monde, lui, est son nom — on le prend avant le slogan.
  const titre = page.title || page.tag || page.slogan || "";
  const chapo = page.subtitle || page.desc || "";
  return { titre, chapo };
}

// Rendre absolu tout chemin relatif d'un href ou d'un src.
//
// Les pages d'articles vivent à /actualites/<slug> : un chemin relatif y
// repart de /actualites/ et pointe dans le vide. Plutôt que de corriger au cas
// par cas — c'est déjà ce qui a cassé le premier déploiement — on pose la
// règle une fois : ce qui ne commence ni par http, ni par /, ni par # ou
// mailto: reçoit sa barre de tête.
export function absolutiser(html) {
  return String(html).replace(/(\s(?:href|src)=")(?!https?:|\/|#|mailto:|tel:|data:)([^"]*)"/g,
    (_, avant, chemin) => `${avant}/${chemin}"`);
}

export function corpsHTML(cle, page) {
  const { titre, chapo } = enTeteDe(cle, page);
  const sections = tab(page.sections).map(sectionHTML).join("\n");
  return absolutiser(`<article>\n${h(1, titre)}\n${p(chapo)}\n${sections}\n</article>`);
}

// ===========================================================================
//  Actualités
// ---------------------------------------------------------------------------
// Les articles viennent de la base, pas de contenu.js : build.mjs les lit par
// news_public() au moment du déploiement. Le rendu ci-dessous reproduit celui
// d'index.js (actuBloc), à une différence près : un lien interne « #stages »
// devient « /stages ». Servir à un robot un lien qui ne mène nulle part, c'est
// perdre le maillage interne qu'on vient de construire.
// ===========================================================================

export function actuBlocHTML(b) {
  if (!b || typeof b !== "object") return "";
  if (b.t === "p") return p(b.x);
  if (b.t === "h2") return h(2, b.x);
  if (b.t === "quote") {
    return `<blockquote><p>${esc(b.x || "")}</p>${
      b.src ? `<cite>${esc(b.src)}</cite>` : ""}</blockquote>`;
  }
  if (b.t === "img" && b.x) {
    return `<figure><img src="${esc(b.x)}" alt="${esc(b.alt || "")}" loading="lazy" />${
      b.cap ? `<figcaption>${esc(b.cap)}</figcaption>` : ""}</figure>`;
  }
  // Même garde qu'index.js : seuls http(s) et les ancres internes passent. Une
  // adresse « javascript: » glissée en base ne doit pas devenir un lien.
  if (b.t === "lien" && typeof b.x === "string") {
    if (/^#[\w-]+$/.test(b.x)) {
      return `<p><a href="${esc(lienDe(b.x))}">${esc(b.label || "En savoir plus")}</a></p>`;
    }
    if (/^https?:\/\//i.test(b.x)) {
      return `<p><a href="${esc(b.x)}" target="_blank" rel="noopener">${esc(b.label || "Voir")}</a></p>`;
    }
    return "";
  }
  return "";
}

export function articleHTML(a) {
  const corps = tab(a.body).map(actuBlocHTML).join("\n");
  const date = a.published_on
    ? `<p><time datetime="${esc(a.published_on)}">${esc(a.published_on)}</time>${
        a.author ? ` · ${esc(a.author)}` : ""}${a.category ? ` · ${esc(a.category)}` : ""}</p>`
    : "";
  const couv = a.cover_url
    ? `<figure><img src="${esc(a.cover_url)}" alt="${esc(a.cover_alt || a.title || "")}" /></figure>` : "";
  return absolutiser(`<article>
${h(1, a.title)}
${date}
${p(a.lede)}
${couv}
${corps}
<p><a href="/actualites">Toutes les actualités</a></p>
</article>`);
}

export function listeActusHTML(articles) {
  const items = tab(articles).map((a) => `<li>
    <article>
      <h2><a href="/actualites/${esc(a.slug)}">${esc(a.title)}</a></h2>
      ${a.category ? `<p>${esc(a.category)}${
        a.published_on ? ` · <time datetime="${esc(a.published_on)}">${esc(a.published_on)}</time>` : ""}</p>` : ""}
      ${p(a.lede)}
    </article>
  </li>`).join("\n");
  return absolutiser(`<article>
<h1>Actualités</h1>
<p>La vie de l'académie, semaine après semaine : les stages, les tournois, les parcours de nos joueuses et joueurs, et les gens qui font le club.</p>
<ul>
${items}
</ul>
</article>`);
}

// Une description d'article : son chapô, coupé proprement comme les autres.
export function descriptionArticle(a) {
  const brut = String(a.lede || a.title || "").replace(/\s+/g, " ").trim();
  if (brut.length <= 155) return brut;
  const coupe = brut.slice(0, 155);
  return coupe.slice(0, coupe.lastIndexOf(" ")).replace(/[ ,;:]+$/, "") + "…";
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
