// Site public dynamique : mondes + pages détaillées (routage par ancre).
import { sb, getSession, myRoles, hasAny, landingFor, CONSOLE_ROLES, frDate, jours } from "./common.js";
import "./pretty-select.js";
import { SEEDS, DRAPEAUX } from "./seeds-data.js";
import { SUPABASE_URL } from "./config.js";
import { hit } from "./hit.js";
import "./pretty-date.js";

const $ = (id) => document.getElementById(id);
const CONTACT_TARGET = "info@teamlausanne.ch"; // destinataire de tous les formulaires

// Partenaires : une seule liste, lue a la fois par la section du tournoi et par
// le bandeau « Nos partenaires officiels » du bas de page. Les logos sont noirs
// sur fond transparent ; « svg » designe les deux qu'on possede en vectoriel.
const PARTENAIRES = [
  { n: "Ville de Lausanne",              l: "ville-lausanne", w: 470, h: 69,      u: "https://www.lausanne.ch/" },
  { n: "Canton de Vaud",                 l: "canton-vaud", w: 470, h: 111,         u: "https://www.vd.ch/" },
  { n: "Swiss Tennis",                   l: "swiss-tennis", w: 471, h: 95,        u: "https://www.swisstennis.ch/" },
  { n: "Fonds du Sport Vaudois",         l: "fonds-sport-vaudois", w: 470, h: 112, u: "https://ffsv.ch/" },
  { n: "Association Vaudoise de Tennis", l: "vaud-tennis", w: 470, h: 198,         u: "https://www.vaud-tennis.ch/" },
  { n: "SVR Vins",                       l: "svr-vins", w: 469, h: 195,            u: "https://svrvins.ch/" },
  { n: "ibis Lausanne",                  l: "ibis", w: 268, h: 267,                u: "https://all.accor.com/hotel/6772/index.fr.shtml" },
  { n: "Garage de la Plaine",            l: "garage-plaine", w: 495, h: 62,       u: "https://www.garageplaine.ch/", svg: true },
  { n: "BS Architectes",                 l: "bs-architectes", w: 367, h: 74,      u: "https://bs-ac.ch/", svg: true },
  { n: "Cafés Cuendet",                  l: "cafes-cuendet", w: 471, h: 131,       u: "https://cafes-cuendet.ch/" },
  { n: "Boissons Gros de Vaud",          l: "boissons-gros-vaud", w: 470, h: 161,  u: "https://www.boissons-gros-de-vaud.ch/" },
  { n: "Nestlé Community",               l: "nestle", w: 470, h: 87,              u: "https://www.nestle.ch/fr/nestle-en-suisse/nestle-community" },
  { n: "Santé Prilly",                   l: "sante-prilly", w: 255, h: 265,        u: "https://www.santeprilly.ch/" },
  { n: "Sport et Solidarité",            l: "sport-solidarite", w: 471, h: 257,    u: "https://www.sportetsolidarite.ch/" },
];

// Icones du tableau des chiffres cles. Dessinees plutot qu'en police d'icones :
// une police de plus a charger pour quatre traits ne se justifie pas.
const ICO_STAT = {
  date: '<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>',
  coupe: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a4 4 0 0 1-4 4M7 5H4v2a4 4 0 0 0 4 4"/>',
  billet: '<path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z"/><path d="M13 7v2M13 13v2"/>',
  ecusson: '<path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5l8-3z"/><path d="M9 12l2 2 4-4"/>',
};
// Ateliers des rendez-vous de saison : une icone par theme, au trait comme le
// reste des pictogrammes du site (24x24, 1.7, bouts ronds).
const ICO_ATELIER = {
  balle: '<circle cx="12" cy="12" r="9"/><path d="M6.5 4.9a9 9 0 0 1 0 14.2M17.5 4.9a9 9 0 0 0 0 14.2"/>',
  haltere: '<path d="M3.5 9.5v5M6.5 7.5v9M6.5 12h11M17.5 7.5v9M20.5 9.5v5"/>',
  cerveau: '<path d="M12 5.6a2.9 2.9 0 0 0-5.5-1.3A2.7 2.7 0 0 0 3.9 7.9c0 .6.2 1.2.6 1.7A2.8 2.8 0 0 0 3.2 12c0 1.1.6 2 1.5 2.5a2.7 2.7 0 0 0 2.1 4.3c.5.9 1.5 1.5 2.6 1.5 1.4 0 2.6-1 2.6-2.5"/>'
    + '<path d="M12 5.6a2.9 2.9 0 0 1 5.5-1.3A2.7 2.7 0 0 1 20.1 7.9c0 .6-.2 1.2-.6 1.7A2.8 2.8 0 0 1 20.8 12c0 1.1-.6 2-1.5 2.5a2.7 2.7 0 0 1-2.1 4.3c-.5.9-1.5 1.5-2.6 1.5-1.4 0-2.6-1-2.6-2.5"/>'
    + '<path d="M12 5.6v12.2"/>',
  equipe: '<circle cx="12" cy="7.2" r="2.9"/><path d="M7.3 19.6a4.7 4.7 0 0 1 9.4 0"/>'
    + '<circle cx="4.9" cy="11.2" r="2.1"/><path d="M1.6 19.6a3.4 3.4 0 0 1 3.8-3"/>'
    + '<circle cx="19.1" cy="11.2" r="2.1"/><path d="M22.4 19.6a3.4 3.4 0 0 0-3.8-3"/>',
};
const icoAtelier = (k) => ICO_ATELIER[k]
  ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO_ATELIER[k]}</svg>`
  : "";

// Un vainqueur : drapeau et nom dans un meme bloc insecable, sinon le retour a
// la ligne peut tomber entre les deux.
const palmJoueurs = (liste) => [].concat(liste)
  .map((j) => `<span class="palm-j">${j.f}${esc(j.n)}</span>`).join("");

// Coupe en filigrane des fiches du palmares. Purement decorative, donc retiree
// de l'arbre d'accessibilite.
const ICO_COUPE = `<svg class="palm-coupe" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a4 4 0 0 1-4 4M7 5H4v2a4 4 0 0 0 4 4"/></svg>`;
const icoStat = (k) => ICO_STAT[k]
  ? `<svg class="stat-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO_STAT[k]}</svg>`
  : "";

const partLogo = (p) => `assets/partenaires/${p.l}.${p.svg ? "svg" : "png"}`;

// Les quatorze partenaires ci-dessus sont ceux du TOURNOI : ils ne s'affichent
// que sur la page du Lausanne Open, dans sa propre section. Le bandeau du bas de
// page, lui, appartient a l'academie et ne porte que ses deux partenaires. Une
// seule liste de donnees, deux sous-ensembles.
const PARTENAIRES_ACADEMIE = ["garage-plaine", "bs-architectes"]
  .map((l) => PARTENAIRES.find((p) => p.l === l)).filter(Boolean);


// ===================================================================
//  MONDES
// ===================================================================
// Tout le texte du site vit dans contenu.js, en données pures. Le chatbot va
// lire CE fichier-là à son adresse publique pour se constituer sa base de
// connaissances : une seule source, donc jamais de réponse à côté du site.
import { CONTENU } from "./contenu.js";

const MENTION_IMAGE = CONTENU.mention_image;
const COACHS = CONTENU.coachs;

// contenu.js n'a pas le droit aux références croisées — sans quoi le bot
// devrait exécuter notre code pour le relire. Les renvois dont le site a besoin
// y sont donc écrits en texte, « @clé », et résolus ici à la lecture.
//
// La liste est fermée exprès : une valeur commençant par @ qui ne serait pas
// prévue reste telle quelle plutôt que d'aller chercher une clé au hasard dans
// le fichier. Une faute de frappe se voit alors à l'écran, au lieu de faire
// apparaître silencieusement autre chose.
const RENVOIS = {
  "@coachs": () => COACHS,
  "@flag_ch": () => CONTENU.flag_ch,
  "@flag_ie": () => CONTENU.flag_ie,
  "@flag_fr": () => CONTENU.flag_fr,
  "@itf_url": () => CONTENU.itf_url,
  "@gamezone_url": () => CONTENU.gamezone_url,
};
function resoudre(o) {
  if (typeof o === "string") return RENVOIS[o] ? RENVOIS[o]() : o;
  if (Array.isArray(o)) return o.map(resoudre);
  if (o && typeof o === "object") {
    // { type: "mention" } sans titre = la mention « droit à l'image » commune.
    if (o.type === "mention" && !o.title) return { ...MENTION_IMAGE };
    const r = {};
    for (const [k, v] of Object.entries(o)) r[k] = resoudre(v);
    return r;
  }
  return o;
}
const WORLDS = resoudre(CONTENU.worlds);
const DETAILS = resoudre(CONTENU.details);

// ===================================================================
//  RENDU
// ===================================================================
// Bandeau defilant de logos. Les images ne sont PAS en chargement differe :
// elles defilent horizontalement, donc une image encore absente laisse un trou
// au milieu du bandeau. Elles annoncent leurs dimensions (la place est reservee
// avant l'arrivee du fichier, sinon la serie est mesuree trop courte et le
// bandeau file trop vite) et passent en priorite basse.
// La serie est rendue deux fois et la piste se
// translate d'exactement une serie : la copie arrive pile ou etait l'originale,
// donc la boucle ne se voit pas. Meme mecanique que les bandeaux de mots-cles,
// duree calee en JS pour garder la meme vitesse a toutes les largeurs.
function reelHTML(items) {
  const serie = (copie) => `<ul class="reel-serie"${copie ? ' aria-hidden="true"' : ""}>${items.map((p) =>
    `<li><a class="reel-logo" href="${esc(p.u)}" target="_blank" rel="noopener"
        title="${esc(p.n)}"${copie ? ' tabindex="-1"' : ""}><img src="${partLogo(p)}"
        alt="${esc(p.n)}" width="${p.w}" height="${p.h}"
        decoding="async" fetchpriority="low" /></a></li>`).join("")}</ul>`;
  return `<div class="reel"><div class="reel-piste">${serie(false)}${serie(true)}</div></div>`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function linkHTML(link) {
  if (!link) return "";
  if (link.action === "login")
    return `<button class="wsec-link" data-login>${esc(link.label)}</button>`;
  if (link.contact)
    return `<button class="contact-cta" data-contact="${esc(link.contact)}">${esc(link.label)}</button>`;
  // Allure des boutons de l'accueil (pilule blanche, disque fluo, fleche).
  if (link.cta) {
    const cible = link.scroll ? `data-scroll="${esc(link.scroll)}"` : `data-contact="${esc(link.contact)}"`;
    return `<button class="btn-cta wsec-cta" ${cible}>${esc(link.label)}</button>`;
  }
  if (link.scroll)
    return `<button class="contact-cta" data-scroll="${esc(link.scroll)}">${esc(link.label)}</button>`;
  const ext = link.href.startsWith("http");
  return `<a class="wsec-link" href="${esc(link.href)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${esc(link.label)}</a>`;
}

function sectionWrap(sec) {
  let html = sectionHTML(sec);
  if (sec.anchor) html = html.replace("<section ", `<section data-anchor="${sec.anchor}" `);
  return html;
}

// Balle de tennis des bandeaux de mots-cles : disque plein, et les deux coutures
// reprennent la couleur du fond pour se decouper dedans.
const BALLE = `<svg class="kw-balle" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <circle cx="12" cy="12" r="10" fill="currentColor"/>
  <path d="M4.7 5.1a9.4 9.4 0 0 1 3.1 6.9 9.4 9.4 0 0 1-3.1 6.9M19.3 5.1a9.4 9.4 0 0 0-3.1 6.9 9.4 9.4 0 0 0 3.1 6.9"
        fill="none" stroke="var(--kw-fond)" stroke-width="1.7" stroke-linecap="round"/>
</svg>`;

// ---- Cartes et fiches des coachs ------------------------------------------
// La carte est un <article>, pas un <button> : elle contient un titre, un
// paragraphe et une liste, que la specification interdit dans un bouton — et un
// lecteur d'ecran annoncerait tout le bloc comme un seul libelle. Le clic sur la
// carte reste un confort ; la commande est le bouton « En savoir plus », nomme
// d'apres son coach, seul element atteignable au clavier.
// Par defaut la photo suit le slug. « photo » et « portrait » permettent d'en
// viser une autre : Celyan n'a pas encore de photo faite pour cette page, et
// reutilise en attendant celle de son portrait d'eleve.
const coachPhoto = (c) => c.photo || `assets/photos/coaches/${c.slug}.jpg`;
const coachPortrait = (c) => c.portrait || `assets/photos/coaches/${c.slug}-large.jpg`;

// Fleche du bouton, reprise de la page d'origine.
const CCH_FLECHE = `<svg class="cch-fleche" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
  <path d="M7 7H17V17" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="round"/>
  <path d="M7 17L16.36 7.64" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="round"/></svg>`;

function coachCarte(c) {
  return `<article class="cch-carte" data-cch="${esc(c.slug)}">
    <div class="cch-txt">
      <span class="cch-role">${esc(c.role)}</span>
      <div>
        <h3 class="cch-nom">${esc(c.nom)}</h3>
        <p class="cch-resume">${esc(c.resume)}</p>
        <ul class="cch-tags">${c.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      </div>
    </div>
    <div class="cch-photo">
      <img src="${esc(coachPhoto(c))}" alt="${esc(c.nom)}" />
      <button type="button" class="cch-plus" aria-haspopup="dialog"
        aria-label="En savoir plus sur ${esc(c.nom)}">En savoir plus${CCH_FLECHE}</button>
    </div>
  </article>`;
}

// Un bloc de la fiche : un intertitre et sa liste. Rien n'est affiche si la
// liste est vide, plutot qu'un titre orphelin.
const coachBloc = (titre, items) => !items || !items.length ? ""
  : `<h4>${esc(titre)}</h4><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;

function coachFiche(c) {
  return `<div class="cch-fiche" id="cch-${esc(c.slug)}" role="dialog" aria-modal="true"
       aria-labelledby="cch-t-${esc(c.slug)}" hidden>
    <div class="cch-voile" data-cch-fermer></div>
    <div class="cch-panneau">
      <button type="button" class="cch-fermer" data-cch-fermer aria-label="Fermer">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <div class="cch-panneau-def">
        <div class="cch-fiche-haut">
          <span class="eyebrow">${esc(c.role)}</span>
          <h3 class="cch-nom" id="cch-t-${esc(c.slug)}">${esc(c.nom)}</h3>
          <div class="cch-bio">
            ${c.bio.map((p) => `<p>${esc(p)}</p>`).join("")}
            ${c.citation ? `<blockquote class="cch-cite">${esc(c.citation)}</blockquote>` : ""}
            ${coachBloc("Classement", c.classement)}
            ${coachBloc("Formations", c.formations)}
            ${coachBloc("Parcours", c.parcours)}
          </div>
        </div>
        <ul class="cch-fiche-tags">${c.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        <img class="cch-fiche-photo" data-src="${esc(coachPortrait(c))}" alt="${esc(c.nom)}"
          ${c.portraitPos ? `style="object-position:${esc(c.portraitPos)}"` : ""} />
      </div>
    </div>
  </div>`;
}

// Ouverture et fermeture. Un seul jeu de fonctions, appele depuis le gestionnaire
// de clic general plus bas.
let coachOuverte = null, coachAppelante = null;

function coachOuvrir(slug) {
  const f = document.getElementById("cch-" + slug);
  if (!f) return;
  coachFermer();
  coachOuverte = f;
  f.hidden = false;
  document.documentElement.style.overflow = "hidden";
  // La photo n'est demandee qu'a la premiere ouverture, et par le script : une
  // image dont un parent est cache ne declenche pas le chargement differe natif.
  const ph = f.querySelector(".cch-fiche-photo[data-src]");
  if (ph) { ph.src = ph.getAttribute("data-src"); ph.removeAttribute("data-src"); }
  const x = f.querySelector(".cch-fermer");
  if (x) x.focus();
}

function coachFermer() {
  if (!coachOuverte) return;
  coachOuverte.hidden = true;
  coachOuverte = null;
  document.documentElement.style.overflow = "";
  if (coachAppelante) { coachAppelante.focus(); coachAppelante = null; }
}

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && coachOuverte) coachFermer(); });

function sectionHTML(sec) {
  switch (sec.type) {
    case "split":
      return `<section class="split${(sec.video || sec.videoFile) ? " split-hasvideo" : ""}">
        ${(sec.video || sec.videoFile)
          ? (sec.videoFile
            ? `<div class="split-media split-video${sec.vertical ? " split-video-vertical" : ""}"><video class="split-native" controls playsinline preload="metadata" poster="${esc(sec.poster || "")}"><source src="${esc(sec.videoFile)}" type="video/mp4" />Votre navigateur ne peut pas lire cette vidéo.</video></div>`
            // Avec une affiche : on montre l'image du site et un bouton. YouTube
            // n'est appele qu'au clic — donc ni cookie, ni bandeau de titre, ni
            // suggestions tant que la video n'est pas lancee.
            : sec.poster
            ? `<div class="split-media split-video split-film">
                 <button type="button" class="film-lance" data-film="${esc(sec.video)}"
                   data-titre="${esc(sec.title)}" aria-label="Lire la vidéo : ${esc(sec.title)}">
                   <img class="film-affiche" src="${esc(sec.poster)}" alt="" loading="lazy" />
                   <span class="film-play" aria-hidden="true"></span>
                 </button>
               </div>`
            : `<div class="split-media split-video${sec.vertical ? " split-video-vertical" : ""}"><iframe src="https://www.youtube.com/embed/${esc(sec.video)}" title="${esc(sec.title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`)
          : sec.photos
            ? `<div class="split-media split-scroller">${sec.photos.map((it, i) => {
                const p = typeof it === "string" ? it : it.src;
                const pos = (typeof it === "object" && it.pos) ? `;background-position:${it.pos}` : "";
                return `<div class="ss-photo${i ? "" : " on"}" style="background-image:url('${p}')${pos}"></div>`;
              }).join("")}
                <div class="ss-dots">${sec.photos.map((_, i) =>
                  `<button type="button" class="ss-dot${i ? "" : " on"}" data-ss="${i}" aria-label="Photo ${i + 1}"></button>`).join("")}</div>
              </div>`
            : `<div class="split-media" style="background-image:url('${sec.photo}')"></div>`}
        <div class="split-body">${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}<h2>${esc(sec.title)}</h2>
          ${sec.body.map((p) => `<p>${esc(p)}</p>`).join("")}${linkHTML(sec.link)}</div>
      </section>`;

    case "features":
      return `<section class="wsec">${sec.title ? `<h2>${esc(sec.title)}</h2>` : ""}
        <div class="feature-grid">${sec.items.map(([h, t]) =>
          `<div class="feature"><h3>${esc(h)}</h3><p>${esc(t)}</p></div>`).join("")}</div>
        ${linkHTML(sec.link)}</section>`;

    case "cards":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="card-grid">${sec.items.map((o) =>
          `<a class="pcard" href="${esc(o.href)}">
            <div class="pcard-media" style="background-image:url('${o.photo}')"></div>
            <div class="pcard-body"><div class="offer-top"><h3>${esc(o.name)}</h3>
              ${o.meta ? `<span class="offer-meta">${esc(o.meta)}</span>` : ""}</div>
              <p>${esc(o.detail)}</p><span class="pcard-more">En savoir plus →</span></div>
          </a>`).join("")}</div></section>`;

    case "offers":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="offer-grid">${sec.items.map((o) =>
          `<div class="offer"><div class="offer-top"><h3>${esc(o.name)}</h3>
            ${o.meta ? `<span class="offer-meta">${esc(o.meta)}</span>` : ""}</div>
            <p>${esc(o.detail)}</p></div>`).join("")}</div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}</section>`;

    case "timeline":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="timeline">${sec.items.map(([y, t]) =>
          `<div class="tl-row"><div class="tl-year">${esc(y)}</div><div class="tl-text">${esc(t)}</div></div>`).join("")}</div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}</section>`;

    case "committee":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="committee">${sec.members.map(([n, r]) =>
          `<div class="cm"><b>${esc(n)}</b><span>${esc(r)}</span></div>`).join("")}</div>
        ${sec.honor ? `<p class="wsec-note">Membres d'honneur : ${sec.honor.map(esc).join(" · ")}</p>` : ""}</section>`;

    case "contact":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="contact-card"><p>${sec.lines.map(esc).join("<br>")}</p>
          <p><a href="tel:${esc(sec.phone.replace(/\s/g, ""))}">${esc(sec.phone)}</a></p>
          ${sec.hours ? `<p class="muted">${esc(sec.hours)}</p>` : ""}
          <button class="contact-cta" data-contact="${esc(sec.contact || sec.title)}">Nous écrire</button></div></section>`;

    case "rich":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="rich">${sec.body.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}${linkHTML(sec.link)}</section>`;

    // Mention legale en bas de page (petits caracteres). Volontairement lisible
    // malgre sa taille : une mention qu'on ne peut pas lire ne protege personne,
    // et c'est le genre de texte qu'un parent vient relire apres coup.
    case "mention":
      return `<section class="mention" aria-label="${esc(sec.title)}">
        <h2>${esc(sec.title)}</h2>
        <p>${esc(sec.body)}</p></section>`;

    // Deux presentations pour les memes donnees. Par defaut, des cartes claires
    // dans le fil de la page. Avec « board », un bandeau sombre pleine largeur :
    // sur la page du tournoi, ces quatre chiffres SONT l'accroche, ils ne
    // peuvent pas ressembler au reste du contenu.
    case "stats": {
      // « 35 » ou « 2h » : on separe le nombre de son unite pour ne compter
      // que le nombre. Sans separation, l'unite disparaitrait pendant le
      // comptage puis reviendrait d'un coup.
      const C = sec.variant === "board" ? "sbc" : "stat";
      const cellule = (it) => {
        const [b, s, opts] = Array.isArray(it) ? it : [it.v, it.l, it];
        const m = /^(\d[\d\u00a0 ]*)(.*)$/.exec(String(b));
        // Le compteur ne tourne que sur un vrai nombre : « 30 000 » porte une
        // espace insecable, qu'il faut retirer avant de le compter.
        const brut = m ? m[1].replace(/[^\d]/g, "") : "";
        const chiffre = m ? `<span class="stat-val" data-vers="${brut}" data-groupe="${m[1].trim() !== brut ? "1" : ""}">${esc(m[1].trim())}</span>` : "";
        // « 30 000 $ » : l'espace qui sépare le nombre de son unité est en fin
        // de <span>, donc le navigateur la supprime et on lisait « 30 000$ ».
        // On la remet, insécable, entre les deux éléments.
        const unite = m ? (/\s$/.test(m[1]) ? "\u00a0" : "") + m[2] : String(b);
        const corps = `${opts && opts.ico ? icoStat(opts.ico) : ""}
          <b>${chiffre}${esc(unite)}</b><span>${esc(s)}</span>`;
        // Une tuile qui mene quelque part le dit : elle devient un vrai lien ou
        // un bouton, pas un bloc decore d'un curseur en main.
        if (opts && opts.href) {
          const ext = opts.href.startsWith("http");
          return `<a class="${C} ${C}-lien" href="${esc(opts.href)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${corps}
            <span class="stat-fleche" aria-hidden="true">↗</span></a>`;
        }
        if (opts && opts.scroll)
          return `<button type="button" class="${C} ${C}-lien" data-scroll="${esc(opts.scroll)}">${corps}
            <span class="stat-fleche" aria-hidden="true">↓</span></button>`;
        return `<div class="${C}">${corps}</div>`;
      };
      const cells = sec.items.map(cellule).join("");
      if (sec.variant !== "board")
        return `<section class="wsec"><div class="stat-row">${cells}</div></section>`;
      return `<section class="wsec stat-board" data-anchor="${esc(sec.anchor || "")}">
        <div class="stat-board-in"><div class="sb-row">${cells}</div></div></section>`;
    }

    case "podium":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="podium">${sec.items.map(([n, w], i) =>
          `<div class="pod pod-${i + 1}"><div class="pod-rank">${esc(String(w))}</div>
            <b>${esc(n)}</b><span>victoires</span></div>`).join("")}</div>
        ${linkHTML(sec.link)}</section>`;

    // Palmares : un tableau a deux lignes se lisait comme un releve de compte.
    // Une fiche par edition, avec le millesime grave, le vainqueur en simple mis
    // en avant (c'est LE titre) et la paire du double en dessous.
    case "palmares":
      return `<section class="wsec" data-anchor="${esc(sec.anchor || "")}">
        <div class="palm-tete"><h2>${esc(sec.title)}</h2>
          ${sec.sub ? `<p class="wsec-sub">${esc(sec.sub)}</p>` : ""}</div>
        <ol class="palm">${sec.editions.map((e, i) => `
          <li class="palm-an${i === 0 ? " palm-dernier" : ""}">
            <div class="palm-millesime"><span>${esc(e.an)}</span>
              ${i === 0 ? '<em class="palm-tag">Tenant du titre</em>' : ""}</div>
            <div class="palm-titres">
              <div class="palm-t palm-simple">
                <span class="palm-lab">Simple</span>
                <span class="palm-qui">${palmJoueurs(e.simple)}</span>
              </div>
              <div class="palm-t palm-double">
                <span class="palm-lab">Double</span>
                <span class="palm-qui">${palmJoueurs(e.double)}</span>
              </div>
            </div>
            ${ICO_COUPE}
          </li>`).join("")}</ol>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}</section>`;

    case "ranking":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <table class="ranking"><thead><tr>${sec.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${sec.rows.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}</section>`;

    // Cartes de joueur facon carte a collectionner : la photo occupe toute la
    // carte, le numero de tete de serie est grave en fond, et la biographie ne
    // sort qu'a la demande. Huit pavés de texte alignes se lisaient comme un
    // tableau ; ici on parcourt des visages et on ouvre celui qui intrigue.
    // Le bouton porte l'ouverture : au doigt il n'y a pas de survol, un simple
    // effet :hover aurait rendu les biographies inaccessibles sur telephone.
    case "seeds":
      return `<section class="wsec" data-anchor="${esc(sec.anchor || "")}"><h2>${esc(sec.title)}</h2>
        ${sec.sub ? `<p class="wsec-sub">${esc(sec.sub)}</p>` : ""}
        <div class="pcard-grille">${SEEDS.map((s) => {
          const sommet = s.atp === s.best;
          const rang = sommet ? "au meilleur de sa carrière" : `meilleur : ${s.best}ᵉ`;
          return `<button type="button" class="pcard" aria-expanded="false">
            <span class="pcard-photo">
              <img src="assets/players/${esc(s.photo)}" alt="${esc(s.nom)}" loading="lazy" />
            </span>
            <span class="pcard-n" aria-hidden="true">${s.n}</span>
            <span class="pcard-bas">
              <span class="pcard-tete">
                <span class="seed-flag">${DRAPEAUX[s.drapeau] || DRAPEAUX.neutre}</span>
                <span class="pcard-nom">${esc(s.nom)}</span>
              </span>
              <span class="pcard-atp">ATP <b>${s.atp}</b><span class="pcard-best"> · ${esc(rang)}</span></span>
              <span class="pcard-bio"><span>${esc(s.bio)}</span></span>
            </span>
            <span class="pcard-plus" aria-hidden="true">+</span>
          </button>`;
        }).join("")}</div></section>`;

    // Les logos ne sont plus des tuiles bleues alignees mais un bandeau qui
    // file : un mur de quatorze pave etait une fin de page pesante, et chaque
    // logo y valait la meme chose qu'un bloc de texte.
    case "sponsors":
      return `<section class="wsec sponsors-sec" data-anchor="${esc(sec.anchor || "")}">
        <div class="sponsors-head"><h2>${esc(sec.title)}</h2>
          ${sec.sub ? `<p class="wsec-sub">${esc(sec.sub)}</p>` : ""}</div>
        ${reelHTML(sec.items || PARTENAIRES)}</section>`;

    // Une serie de cartes. Rendue deux fois : l'originale et une copie inerte,
    // pour que le defilement puisse boucler sans saut visible.
    case "carousel": {
      const carte = (items, mkPill) => items.map((o) =>
        `<article class="ccard"><div class="ccard-media${o.plan ? " ccard-media-plan" : ""}" style="background-image:url('${o.photo}')"></div>
          ${mkPill(o)}</article>`).join("");
      const pillInerte = (o) =>
        `<span class="ccard-pill ccard-pill-static">${esc(o.name)}<span class="ccard-arrow" aria-hidden="true">↗</span></span>`;
      const pill = (o) => {
        const inner = `${esc(o.name)}<span class="ccard-arrow" aria-hidden="true">↗</span>`;
        if (o.plan) return `<button class="ccard-pill" data-plan="${esc(o.photo)}">${inner}</button>`;
        if (o.login) return `<button class="ccard-pill" data-login>${inner}</button>`;
        if (o.goto) return `<button class="ccard-pill" data-goto="${esc(o.goto.world)}" data-anchor="${esc(o.goto.anchor)}">${inner}</button>`;
        if (!o.href) return `<span class="ccard-pill ccard-pill-static">${inner}</span>`;
        const ext = o.href.startsWith("http");
        const tgt = ext ? ' target="_blank" rel="noopener"' : "";
        return `<a class="ccard-pill" href="${esc(o.href)}"${tgt}>${inner}</a>`;
      };
      return `<section class="wsec carousel-sec">
        <div class="carousel-head">
          ${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}
          <h2>${esc(sec.title)}</h2>
          ${sec.sub ? `<p class="carousel-sub">${esc(sec.sub)}</p>` : ""}
        </div>
        <div class="carousel"><div class="carousel-track" data-n="${sec.items.length}" style="--n:${sec.items.length}">
          ${carte(sec.items, pill)}
          <!-- Copie de la serie : c'est elle qui rend la boucle continue. Retiree
               de l'arbre d'accessibilite, et ses pastilles sont inertes pour ne
               pas creer de doublons au clavier. -->
          <div class="carousel-clone" aria-hidden="true">${carte(sec.items, pillInerte)}</div>
        </div></div></section>`;
    }

    case "formules": {
      // Les tranches d'age presentes servent de filtres : on ne les ecrit pas
      // en dur, elles se deduisent des formules.
      const groupes = [...new Set(sec.items.map((f) => f.groupe).filter(Boolean))];
      const nom = (g) => (sec.libelles && sec.libelles[g]) || g;
      return `<section class="wsec formules">
        <div class="perks-head">
          ${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}
          <h2>${esc(sec.title)}</h2>
          ${sec.intro ? `<p class="perks-lead">${sec.intro}</p>` : ""}
        </div>
        ${groupes.length > 1 ? `<div class="fm-filtres" role="group" aria-label="Filtrer par âge">
          <button type="button" class="fm-filtre on" data-groupe="tous">Toutes</button>
          ${groupes.map((g) => `<button type="button" class="fm-filtre" data-groupe="${esc(g)}">${esc(nom(g))}</button>`).join("")}
        </div>` : ""}
        <div class="formula-grid">${sec.items.map((f) =>
          `<article class="formula${f.pro ? " formula-pro" : ""}" data-groupe="${esc(f.groupe || "")}">
            ${f.rythme ? `<span class="formula-etiq${f.pro ? " formula-etiq-pro" : ""}">${esc(f.rythme)}</span>` : ""}
            <span class="formula-age">${esc(f.age)}</span>
            <h3>${esc(f.name)}</h3>
            ${f.horaire ? `<p class="formula-horaire">${esc(f.horaire)}</p>` : ""}
            <ul>${f.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
            <div class="formula-foot"><span class="formula-price">${esc(f.price)}</span>
              <span class="formula-sem">${esc(f.unite || "la semaine")}</span></div>
          </article>`).join("")}</div>
        ${linkHTML(sec.link)}</section>`;
    }

    case "stageform":
      return `<section class="wsec stagesec">
        <div class="perks-head">
          ${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}
          <h2>${esc(sec.title)}</h2>
          ${sec.lead ? `<p class="perks-lead">${esc(sec.lead)}</p>` : ""}
        </div>
        <div id="stgp-list" class="stg-pub-list"><p class="muted">Chargement…</p></div></section>`;

    case "pricing":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="pricing-list">${sec.items.map(([label, price]) =>
          `<div class="pricing-row"><span class="pl-label">${esc(label)}</span><span class="pl-dots"></span><span class="pl-price">${esc(price)}</span></div>`).join("")}</div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}</section>`;

    case "memberform":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        ${sec.lead ? `<p class="muted" style="max-width:640px;margin:-6px 0 22px">${esc(sec.lead)}</p>` : ""}
        <form id="member-form" class="cform" style="max-width:720px">
          <div class="cf-row">
            <label class="cf-field"><span>Prénom</span><input type="text" id="m-first" required /></label>
            <label class="cf-field"><span>Nom</span><input type="text" id="m-last" required /></label>
          </div>
          <div class="cf-row">
            <label class="cf-field"><span>Email</span><input type="email" id="m-email" autocomplete="email" required /></label>
            <label class="cf-field"><span>Téléphone</span><input type="tel" id="m-phone" autocomplete="tel" required /></label>
          </div>
          <div class="cf-row">
            <label class="cf-field"><span>Date de naissance</span><input type="date" id="m-birth" required /></label>
            <label class="cf-field"><span>Adresse</span><input type="text" id="m-address" required /></label>
          </div>
          <div class="cf-row">
            <label class="cf-field"><span>NPA</span><input type="text" id="m-npa" required /></label>
            <label class="cf-field"><span>Localité</span><input type="text" id="m-city" required /></label>
          </div>
          <label class="cf-field"><span>Message</span><textarea id="m-message" rows="3"></textarea></label>
          <label class="m-consent"><input type="checkbox" id="m-consent" required />
            <span>J'ai lu et j'accepte le <a href="assets/Reglement_TCLS_2026.pdf" target="_blank" rel="noopener">règlement du club (PDF)</a>.</span></label>
          <button type="submit" id="m-btn">Envoyer ma demande d'adhésion</button>
          <p id="m-error" class="error" hidden></p>
        </form>
        <div id="m-done" class="hidden" style="max-width:720px;background:var(--accent-soft);border-radius:16px;padding:24px;text-align:center">
          <p style="font-size:1.15rem;font-weight:800;color:var(--blue-ink);margin:0 0 6px">Merci, votre demande est envoyée !</p>
          <p class="muted" style="margin:0">Le secrétariat vous recontacte pour finaliser votre adhésion.</p>
        </div></section>`;

    case "gzphotos":
      return `<section class="wsec"><div id="gz-photos-carousel" class="gz-carousel"></div></section>`;

    case "gzwinners":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div id="gz-winners"><p class="muted">Chargement…</p></div></section>`;

    case "logos":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="logo-wall">${sec.items.map((src) => `<img src="${src}" alt="" loading="lazy" />`).join("")}</div></section>`;

    case "agenda":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="agenda">${sec.items.map((e) =>
          `<div class="ag-item"><div class="ag-date">${esc(e.date)}</div>
            <div class="ag-body"><b>${esc(e.title)}</b>${e.detail ? `<span>${esc(e.detail)}</span>` : ""}</div></div>`).join("")}</div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}</section>`;

    case "restaurant":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="resto">${sec.photo ? `<div class="resto-photo" style="background-image:url('${sec.photo}')"></div>` : ""}
          <div class="resto-body">${sec.body.map((p) => `<p>${esc(p)}</p>`).join("")}
            ${sec.phone ? `<p><b>Tél. direct :</b> <a href="tel:${esc(sec.phone.replace(/\s/g, ""))}">${esc(sec.phone)}</a></p>` : ""}
            ${sec.hours ? `<p class="muted">${esc(sec.hours)}</p>` : ""}</div></div></section>`;

    case "instagram":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <p class="wsec-sub">La vie du club en images — suivez <a href="https://instagram.com/${esc(sec.handle)}" target="_blank" rel="noopener">@${esc(sec.handle)}</a>.</p>
        <div class="ig-grid">${(sec.photos || []).map((src) =>
          `<a class="ig-cell" href="https://instagram.com/${esc(sec.handle)}" target="_blank" rel="noopener" style="background-image:url('${src}')"></a>`).join("")}</div></section>`;

    // Le parcours de formation, presente en etapes numerotees plutot qu'en
    // pyramide de barres. Les niveaux sont saisis du sommet vers la base
    // (Pro d'abord) ; on les inverse ici pour qu'ils se lisent 01 -> 05, du
    // premier echange a la performance.
    case "pyramid": {
      const etapes = sec.levels.slice().reverse();
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        ${sec.sub ? `<p class="wsec-sub">${esc(sec.sub)}</p>` : ""}
        <div class="path-wrap">
          <ol class="path">${etapes.map((l, i) => {
            const num = String(i + 1).padStart(2, "0");
            const inner = `<span class="path-num">${num}</span>
              <span class="path-name">${esc(l.name)}</span>
              <span class="path-meta">${esc(l.meta)}</span>`;
            return l.href
              ? `<li><a class="path-step" href="${esc(l.href)}">${inner}<span class="path-go">↗</span></a></li>`
              : `<li><div class="path-step">${inner}</div></li>`;
          }).join("")}</ol>
          ${sec.club ? `<aside class="path-club">
            <h3>${esc(sec.club.title)}</h3>
            ${sec.club.body.map((p) => `<p>${esc(p)}</p>`).join("")}
            ${sec.club.href ? `<a class="path-club-link" href="${esc(sec.club.href)}">Découvrir le Club ↗</a>` : ""}
          </aside>` : ""}
        </div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}</section>`;
    }

    case "team": {
      const n = sec.count || (sec.items ? sec.items.length : 0);
      const av = '<div class="coach-photo ph-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="8.5" r="3.7"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg></div>';
      const tiles = Array.from({ length: n }, () => `<figure class="coach team-ph">${av}<figcaption><b>À venir</b><span>Team member</span></figcaption></figure>`).join("");
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        ${sec.sub ? `<p class="wsec-sub">${esc(sec.sub)}</p>` : ""}
        <div class="coach-grid">${tiles}</div></section>`;
    }

    case "coaches":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        ${sec.sub ? `<p class="wsec-sub">${sec.sub}</p>` : ""}
        <div class="coach-grid">${sec.items.map((c) =>
          `<figure class="coach"><div class="coach-photo" style="background-image:url('${c.photo}')"></div>
            <figcaption><b>${esc(c.name)}</b><span>${esc(c.role)}</span>
              ${c.private ? `<span class="coach-priv">Cours privés · ${c.phone ? `<a href="tel:${esc(c.phone.replace(/\s/g, ""))}">${esc(c.phone)}</a>` : "sur demande"}</span>` : ""}
            </figcaption></figure>`).join("")}</div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}</section>`;

    // Galerie en mosaique : toutes les photos a la meme taille se regardaient
    // comme une planche de contact. Ici la premiere et la quatrieme prennent
    // deux fois plus de place, le rythme se casse et l'oeil circule. Chaque
    // vignette s'ouvre en grand (visionneuse), d'ou le <button>.
    case "gallery": {
      const photos = sec.items.map((it) => (typeof it === "string" ? { src: it } : it));
      // Les sources partent dans la visionneuse : elle navigue de l'une a
      // l'autre sans avoir a relire le DOM.
      const srcs = photos.map((p) => p.src);
      return `<section class="wsec" data-anchor="${esc(sec.anchor || "")}">
        <div class="gal" data-srcs="${esc(JSON.stringify(srcs))}">${photos.map((p, i) => `
          <button type="button" class="gphoto" data-i="${i}"
            style="background-image:url('${p.src}')${p.pos ? `;background-position:${p.pos}` : ""}"
            aria-label="Agrandir la photo ${i + 1} sur ${photos.length}">
            <span class="gphoto-loupe" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M11 8v6M8 11h6"/></svg>
            </span>
          </button>`).join("")}</div></section>`;
    }

    case "contactform":
      return `<section class="wsec biz-contact" data-anchor="${esc(sec.anchor || "contact")}">
        <h2>${esc(sec.title)}</h2>
        ${sec.lead ? `<p class="muted" style="max-width:640px;margin:-6px 0 22px">${esc(sec.lead)}</p>` : ""}
        <div class="biz-contact-grid">
          <div class="biz-raph">
            <div class="biz-raph-name">${esc(sec.person)}</div>
            <div class="biz-raph-role">${esc(sec.role)}</div>
            <a class="biz-phone" href="tel:${esc((sec.tel || "").replace(/\s/g, ""))}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L7.8 9.8a16 16 0 0 0 6 6l1.4-1.3a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/></svg>
              ${esc(sec.telLabel)}</a>
          </div>
          <form id="biz-form" class="cform">
            <label class="cf-field"><span>Votre demande</span>
              <select id="biz-subject">
                <option>Devenir partenaire</option>
                <option>Privatisation / événement d'entreprise</option>
                <option>Club des Présidents</option>
                <option>Sponsoring</option>
                <option>Autre</option>
              </select></label>
            <div class="cf-row">
              <label class="cf-field"><span>Nom et prénom</span><input type="text" id="biz-name" required /></label>
              <label class="cf-field"><span>Entreprise / fonction</span><input type="text" id="biz-company" /></label>
            </div>
            <div class="cf-row">
              <label class="cf-field"><span>Email</span><input type="email" id="biz-email" required /></label>
              <label class="cf-field"><span>Téléphone</span><input type="tel" id="biz-phone" /></label>
            </div>
            <label class="cf-field"><span>Message</span><textarea id="biz-message" rows="4"></textarea></label>
            <button type="submit" id="biz-btn">Envoyer ma demande</button>
            <p id="biz-error" class="error" hidden></p>
          </form>
          <div id="biz-done" class="hidden biz-done">
            <p style="font-size:1.15rem;font-weight:800;color:var(--blue-ink);margin:0 0 6px">Merci, c'est envoyé !</p>
            <p class="muted" style="margin:0">Nous revenons vers vous très vite.</p>
          </div>
        </div></section>`;

    case "enroll":
      return `<section class="wsec enroll-sec"><h2>${esc(sec.title || "Demande d'inscription")}</h2>
        ${sec.lead ? `<p class="muted" style="max-width:640px;margin:-6px 0 22px">${esc(sec.lead)}</p>` : ""}
        <form id="enroll-form" class="cform" style="max-width:720px" data-filiere="${esc(sec.filiere)}">
          <div class="cf-row">
            <label class="cf-field"><span>Prénom</span><input type="text" id="en-first" required /></label>
            <label class="cf-field"><span>Nom</span><input type="text" id="en-last" required /></label>
          </div>
          ${sec.adultes ? "" : `<div class="cf-row">
            <label class="cf-field"><span>Date de naissance</span><input type="date" id="en-birth" required /></label>
            <label class="cf-field"><span>N° AVS</span><input type="text" id="en-avs" placeholder="756.XXXX.XXXX.XX" /></label>
          </div>`}
          <div class="cf-row">
            <label class="cf-field"><span>Téléphone</span><input type="tel" id="en-phone" autocomplete="tel" required /></label>
            <label class="cf-field"><span>Email</span><input type="email" id="en-email" autocomplete="email" required /></label>
          </div>
          ${sec.ranking ? `<label class="cf-field"><span>Classement</span><input type="text" id="en-ranking" placeholder="ex. R4, N3, sans classement…" /></label>` : ""}
          ${sec.adultes ? `<div class="cf-row">
            <label class="cf-field"><span>Formule souhaitée</span><select id="en-formule" required>
              <option value="">— choisir —</option>
              <option>Cours privé — 1 personne</option>
              <option>Cours semi-privé — 2 personnes</option>
              <option>Cours de groupe — 3 personnes</option>
              <option>Cours de groupe — 4 personnes</option>
              <option>Formule flexible</option>
            </select></label>
            <label class="cf-field"><span>Fréquence</span><select id="en-freq">
              <option>1× par semaine</option><option>2× par semaine</option><option>3× par semaine</option>
            </select></label>
          </div>
          <label class="cf-field"><span>Vos disponibilités</span><textarea id="en-dispo" rows="3" placeholder="ex. lundi et mercredi soir dès 18h, vendredi à midi…" required></textarea></label>
          <label class="cf-field"><span>Niveau / remarques</span><textarea id="en-comment" rows="2" placeholder="Niveau actuel, classement éventuel, langue souhaitée…"></textarea></label>` : `<label class="cf-field"><span>Commentaire</span><textarea id="en-comment" rows="3"></textarea></label>`}
          <button type="submit" id="en-btn">${sec.adultes ? "Envoyer ma demande" : "Envoyer ma demande d'inscription"}</button>
          <p id="en-error" class="error" hidden></p>
        </form>
        <div id="en-done" class="hidden" style="max-width:720px;background:var(--accent-soft);border-radius:16px;padding:24px;text-align:center">
          <p style="font-size:1.15rem;font-weight:800;color:var(--blue-ink);margin:0 0 6px">Merci, votre demande est envoyée !</p>
          <p class="muted" style="margin:0">${sec.adultes ? "Le responsable des cours adultes et privés vous recontactera rapidement pour en discuter. Rien n'est engagé à ce stade." : "Le secrétariat vous recontacte rapidement."}</p>
        </div></section>`;

    // ---- Bandeau de mots-cles ----
    // Meme principe que le carrousel : la serie est rendue deux fois et la piste
    // se translate d'exactement une serie, d'ou une boucle sans saut visible.
    case "keywords":
      return `<section class="wsec kw-band" aria-label="${esc(sec.label || "Nos points forts")}">
        <div class="kw-piste">${[0, 1].map((copie) =>
          `<ul class="kw-serie"${copie ? ' aria-hidden="true"' : ""}>${sec.items.map((m) =>
            `<li class="kw">${BALLE}${esc(m)}</li>`).join("")}</ul>`).join("")}
        </div></section>`;

    // ---- Les coachs ----
    // Une grille de cartes, chacune ouvrant une fiche detaillee. Les fiches
    // sont ecrites dans la page, cachees, et non fabriquees au clic : le
    // contenu existe pour les moteurs de recherche, et rien ne depend du
    // script pour etre present.
    case "coachs": {
      // Deux mises en page pour les memes cartes : en grille sur la page qui
      // leur est consacree, en piste sur l'accueil, ou six cartes empilees
      // repousseraient tout le reste de la page vers le bas.
      const corps = sec.piste
        ? `<div class="cch-carrousel" data-carrousel data-auto="0">
             <button type="button" class="carr-nav carr-prec" data-carr="-1" aria-label="Coachs précédents" hidden></button>
             <div class="cch-piste" data-piste tabindex="0" role="group" aria-label="Nos coachs, liste défilante">${sec.items.map(coachCarte).join("")}</div>
             <button type="button" class="carr-nav carr-suiv" data-carr="1" aria-label="Coachs suivants" hidden></button>
           </div>`
        : `<div class="cch-grid">${sec.items.map(coachCarte).join("")}</div>`;
      return `<section class="wsec coaches">
        <div class="perks-head">
          ${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}
          <h2>${esc(sec.title)}</h2>
          ${sec.lead ? `<p class="perks-lead">${esc(sec.lead)}</p>` : ""}
        </div>
        ${corps}
        ${sec.lien ? `<p class="cch-tout"><a class="btn-cta" href="${esc(sec.lien.href)}">${esc(sec.lien.label)}</a></p>` : ""}
        ${sec.items.map(coachFiche).join("")}</section>`;
    }

    // ---- Atouts numerotes ----
    case "perks":
      return `<section class="wsec perks">
        <div class="perks-head">
          ${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}
          <h2>${esc(sec.title)}</h2>
          ${sec.lead ? `<p class="perks-lead">${esc(sec.lead)}</p>` : ""}
        </div>
        <div class="perk-grid">${sec.items.map(([h, t], k) =>
          `<article class="perk"><span class="perk-num" aria-hidden="true">${String(k + 1).padStart(2, "0")}</span>
            <h3>${esc(h)}</h3><p>${esc(t)}</p></article>`).join("")}</div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}
        ${linkHTML(sec.link)}</section>`;

    // ---- Calendrier public de la saison ----
    // La coquille seulement : les dates arrivent par agenda_public() une fois
    // la page montée (voir calPubCharger).
    case "calendrier":
      return `<section class="wsec calp"${sec.anchor ? ` id="${esc(sec.anchor)}" data-anchor="${esc(sec.anchor)}"` : ""}>
        <div class="perks-head">
          ${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}
          <h2>${esc(sec.title)}</h2>
          ${sec.lead ? `<p class="perks-lead">${esc(sec.lead)}</p>` : ""}
        </div>
        <div class="calp-barre">
          <button type="button" class="calp-nav" data-calp="-1" aria-label="Mois précédent">‹</button>
          <strong class="calp-mois" id="calp-mois" aria-live="polite">…</strong>
          <button type="button" class="calp-nav" data-calp="1" aria-label="Mois suivant">›</button>
        </div>
        <div class="calp-jours" aria-hidden="true">${
          ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map((j) => `<span>${j}</span>`).join("")}</div>
        <div class="calp-grille" id="calp-grille"></div>
        <div class="calp-liste" id="calp-liste"></div>
        <ul class="calp-legende">${CALP_GENRES.map(([g, lbl]) =>
          `<li class="calp-lg calp-g-${g}"><i aria-hidden="true"></i>${esc(lbl)}</li>`).join("")}</ul>
      </section>`;

    // ---- Rendez-vous de la saison ----
    // Les dates annoncees par newsletter, reprises ici pour que les parents
    // les retrouvent sans rouvrir leur boite mail. Une date sans horaire
    // affiche « horaire a venir » : on n'invente pas ce qui n'a pas ete dit.
    case "rdv":
      return `<section class="wsec rdv">
        <div class="perks-head">
          ${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}
          <h2>${esc(sec.title)}</h2>
          ${sec.lead ? `<p class="perks-lead">${esc(sec.lead)}</p>` : ""}
        </div>
        ${sec.ateliers ? `<ul class="rdv-ateliers">${sec.ateliers.map((a) => {
          // Icone et couleur nommees dans les donnees plutot que deduites du
          // rang : reordonner ou ajouter un atelier ne melange rien.
          const [nom, ico, ton] = Array.isArray(a) ? a : [a, "balle", "blue"];
          return `<li class="rdv-atelier rdv-t-${esc(ton)}">
            <span class="rdv-ico">${icoAtelier(ico)}</span>${esc(nom)}</li>`;
        }).join("")}</ul>` : ""}
        <ol class="rdv-grid">${sec.items.map((d) =>
          `<li class="rdv-date${d.heures ? " rdv-date-ok" : ""}">
            <span class="rdv-jour">${esc(d.jour)}</span>
            <span class="rdv-num">${esc(d.date)}</span>
            <span class="rdv-an">${esc(d.an)}</span>
            <span class="rdv-h">${d.heures ? esc(d.heures) : "horaire à venir"}</span>
          </li>`).join("")}</ol>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}
        ${linkHTML(sec.link)}</section>`;

    // ---- Creneaux et tarif ----
    case "slots":
      return `<section class="wsec slots">
        <div class="perks-head">
          ${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}
          <h2>${esc(sec.title)}</h2>
          ${sec.lead ? `<p class="perks-lead">${esc(sec.lead)}</p>` : ""}
        </div>
        <div class="slot-grid">${sec.items.map((o) =>
          `<article class="slot"><span class="slot-titre">${esc(o.titre)}</span>
            <ul class="slot-heures">${o.heures.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>
            ${o.note ? `<p class="slot-note">${esc(o.note)}</p>` : ""}
            ${o.prix ? `<span class="slot-tarif">${esc(o.prix)}</span>` : ""}</article>`).join("")}</div>
        ${sec.prix ? `<div class="slot-prix">
          <span class="slot-prix-quoi">${esc(sec.prix.label)}</span>
          <b class="slot-prix-montant">${esc(sec.prix.montant)}</b>
          ${sec.prix.detail ? `<span class="slot-prix-detail">${esc(sec.prix.detail)}</span>` : ""}
          ${sec.prix.cta ? `<button class="btn-cta slot-prix-cta" data-scroll="${esc(sec.prix.cta.scroll)}">${esc(sec.prix.cta.label)}</button>` : ""}
        </div>` : ""}
        ${sec.note ? `<p class="slots-note">${esc(sec.note)}</p>` : ""}
        ${linkHTML(sec.link)}</section>`;

    // ---- Questions frequentes ----
    // <details> natif : ouverture au clic comme au clavier, sans une ligne de JS.
    case "faq":
      return `<section class="wsec faq">
        <div class="perks-head">
          ${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}
          <h2>${esc(sec.title)}</h2>
        </div>
        <div class="faq-list">${sec.items.map(([q, r]) =>
          `<details class="faq-item"><summary><span class="faq-q">${esc(q)}</span>
            <span class="faq-signe" aria-hidden="true"></span></summary>
            <div class="faq-rep"><p>${esc(r)}</p></div></details>`).join("")}</div>
        ${linkHTML(sec.link)}</section>`;

    // ---- Video de presentation, dans un cadre aux couleurs de la marque ----
    // Ne s'affiche que si une source existe : mieux vaut pas de bloc qu'un cadre
    // vide. `video` = identifiant YouTube, `videoFile` = fichier mp4 servi par le site.
    case "filmsec": {
      if (!sec.video && !sec.videoFile) return "";
      const dedans = sec.videoFile
        ? `<video class="film-media" controls playsinline preload="metadata"${sec.poster ? ` poster="${esc(sec.poster)}"` : ""}>
             <source src="${esc(sec.videoFile)}" type="video/mp4" />
             Votre navigateur ne peut pas lire cette video.
           </video>`
        : sec.poster
        ? `<button type="button" class="film-lance" data-film="${esc(sec.video)}"
             data-titre="${esc(sec.title)}" aria-label="Lire la vidéo : ${esc(sec.title)}">
             <img class="film-affiche" src="${esc(sec.poster)}" alt="" loading="lazy" />
             <span class="film-play" aria-hidden="true"></span>
           </button>`
        : `<iframe class="film-media" src="https://www.youtube-nocookie.com/embed/${esc(sec.video)}?rel=0&amp;start=0"
             title="${esc(sec.title)}" loading="lazy" frameborder="0" allowfullscreen
             allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`;
      return `<section class="wsec filmsec">
        <div class="perks-head film-head">
          ${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}
          <h2>${esc(sec.title)}</h2>
          ${sec.lead ? `<p class="perks-lead">${esc(sec.lead)}</p>` : ""}
        </div>
        <div class="film-cadre">${dedans}</div>
        ${sec.note ? `<p class="film-note">${esc(sec.note)}</p>` : ""}</section>`;
    }

    // ---- Portraits d'eleves ----
    // La carte se retourne au survol : la photo d'abord, le texte ensuite. Au
    // clavier et au doigt, un clic bascule — sinon le contenu serait inatteignable.
    case "students":
      return `<section class="wsec students">
        <div class="perks-head">
          ${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}
          <h2>${esc(sec.title)}</h2>
          ${sec.lead ? `<p class="perks-lead">${esc(sec.lead)}</p>` : ""}
        </div>
        <div class="eleve-carrousel" data-carrousel>
        <button type="button" class="carr-nav carr-prec" data-carr="-1" aria-label="Athlètes précédents" hidden></button>
        <div class="eleve-piste" data-piste tabindex="0" role="group" aria-label="Nos athlètes, liste défilante">${sec.items.map((e) => {
          // Identifiant de profil myTennis — celui qui figure dans l'adresse,
          // et NON le numero de licence : les deux sont differents, et une
          // adresse batie sur la licence ne mene nulle part. Une adresse
          // complete est acceptee telle quelle.
          const lien = !e.mytennis ? ""
            : /^https?:/.test(e.mytennis) ? e.mytennis
            : `https://www.mytennis.ch/fr/joueur/${encodeURIComponent(e.mytennis)}`;
          return `<article class="eleve">
          <button type="button" class="eleve-face" data-eleve aria-expanded="false">
            <span class="eleve-photo" style="background-image:url('${e.photo}')"></span>
            <span class="eleve-bas">
              <span class="eleve-nom">${esc(e.nom)}</span>
              <span class="eleve-meta">${[e.age, e.classement].filter(Boolean).map(esc).join(" · ")}</span>
            </span>
            <span class="eleve-dos">
              <span class="eleve-dos-nom">${esc(e.nom)}</span>
              <span class="eleve-dos-meta">${[e.age, e.classement].filter(Boolean).map(esc).join(" · ")}</span>
              <span class="eleve-dos-txt">${esc(e.mot || "")}</span>
              ${(e.tags || []).length ? `<span class="eleve-tags">${e.tags.map((t) =>
                `<span class="eleve-tag">${esc(t)}</span>`).join("")}</span>` : ""}
            </span>
            <span class="eleve-plus" aria-hidden="true"></span>
          </button>
          ${lien ? `<a class="eleve-lien" href="${esc(lien)}" target="_blank" rel="noopener"
             title="Profil myTennis de ${esc(e.nom)}">myTennis<span aria-hidden="true"> ↗</span></a>` : ""}
        </article>`;
        }).join("")}</div>
        <button type="button" class="carr-nav carr-suiv" data-carr="1" aria-label="Athlètes suivants" hidden></button>
        </div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}</section>`;

    // ---- Brochure contre une adresse e-mail ----
    case "brochure":
      return `<section class="wsec brochure">
        <div class="broch-in">
          <div class="broch-txt">
            ${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}
            <h2>${esc(sec.title)}</h2>
            ${sec.lead ? `<p class="broch-lead">${esc(sec.lead)}</p>` : ""}
            <form id="broch-form" class="broch-form" data-doc="${esc(sec.doc || "")}" data-sujet="${esc(sec.sujet || "Sport-études")}">
              <label class="broch-champ">
                <span class="sr-only">Votre e-mail</span>
                <input type="email" id="broch-email" required autocomplete="email"
                       placeholder="vous@exemple.ch" />
              </label>
              <button type="submit" class="btn-cta" id="broch-btn">${esc(sec.bouton || "Recevoir la brochure")}</button>
              <p class="broch-msg" id="broch-msg" role="status"></p>
              <p class="broch-rgpd">${esc(sec.mention || "Votre adresse sert uniquement a vous envoyer la brochure et a vous recontacter.")}</p>
            </form>
          </div>
          ${sec.apercu ? `<div class="broch-visuel"><img src="${esc(sec.apercu)}" alt="" loading="lazy" /></div>` : ""}
        </div></section>`;

    default: return "";
  }
}

function paintHero({ logo, heroLogo, hero, heroPos, heroVideo, tag, slogan, desc, ctaHTML, sloganEntier }) {
  $("nav-logo").src = logo;
  $("hero-bg").style.backgroundImage = `url("${hero}")`;
  $("hero-bg").style.backgroundPosition = heroPos || "center";   // point d'intérêt (visages) par page
  $("hero-logo").src = heroLogo || logo;   // hero sur photo : version blanche si le monde en a une
  $("hero-tag").textContent = tag;
  // Un span par mot : c'est ce qui rend chaque mot survolable separement, pour
  // le slogan de l'accueil. Le titre d'une page de filiere, lui, est un seul
  // nom (« Kids Tennis ») : il prend un trait continu et non un par mot.
  // innerHTML est sur ici, le texte vient de la configuration et passe par esc().
  $("hero-slogan").innerHTML = sloganEntier
    ? `<span class="hs-w hs-w-entier">${esc(slogan)}</span>`
    : String(slogan).split(/\s+/).filter(Boolean)
        .map((mot) => `<span class="hs-w">${esc(mot)}</span>`).join(" ");
  $("hero-desc").textContent = desc;
  $("hero-cta").innerHTML = ctaHTML;
  poserVideoHero(heroVideo);
}

// ---- Video de fond du hero ----
// Une video de fond est un confort, jamais le contenu : la photo reste
// dessous et suffit a elle seule. On ne charge donc le film que quand il
// apporte vraiment quelque chose, et jamais au prix de la page.
function poserVideoHero(src) {
  const hero = $("hero");
  const ancienne = hero?.querySelector(".hero-video");
  if (ancienne) ancienne.remove();          // on change de page : on repart de la photo
  if (!src || !hero) return;

  // Trois raisons de s'abstenir :
  //  - le visiteur demande des animations reduites ;
  //  - son navigateur annonce une connexion econome ou lente ;
  //  - l'ecran est etroit, ou la video pese plus que la page entiere pour
  //    un fond que personne ne regarde.
  const co = navigator.connection || {};
  const econome = co.saveData === true || /^(slow-)?2g$/.test(co.effectiveType || "");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (matchMedia("(max-width: 860px)").matches) return;
  if (econome) return;

  const v = document.createElement("video");
  v.className = "hero-video";
  // muted et playsInline sont les deux conditions de la lecture automatique :
  // sans elles, iOS et Chrome refusent de demarrer.
  v.muted = true; v.defaultMuted = true; v.playsInline = true;
  v.loop = true; v.autoplay = true; v.preload = "auto";
  v.setAttribute("aria-hidden", "true");   // decor : rien a annoncer
  v.tabIndex = -1;
  v.src = src;

  // La video ne se montre qu'une fois qu'elle a vraiment des images :
  // sinon on remplacerait la photo par un rectangle noir.
  v.addEventListener("playing", () => { v.classList.add("prete"); hero.classList.add("a-video"); }, { once: true });
  // Si la lecture est refusee ou echoue, on ne fait rien : la photo est deja la.
  v.addEventListener("error", () => v.remove());

  hero.insertBefore(v, hero.querySelector(".hero-scrim"));
  lancer(v);

  // Une page ouverte dans un onglet d'arriere-plan voit sa lecture refusee :
  // Chrome met en pause les medias muets et sans son pour economiser la
  // batterie (« video-only background media was paused to save power »). Ce
  // n'est pas une panne — il faut simplement retenter quand l'onglet revient au
  // premier plan, sinon le fond resterait fige pour qui ouvre le site dans un
  // nouvel onglet.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && v.isConnected && v.paused) lancer(v);
  });
}

function lancer(v) {
  const essai = v.play();
  // On n'enleve pas la video sur un refus : la photo est dessous de toute
  // facon, et le refus est souvent temporaire. Seule une vraie erreur de
  // lecture (evenement « error ») la retire.
  if (essai && essai.catch) essai.catch(() => {});
}


// ---- Visionneuse des galeries ----
// Une seule pour tout le site. Une galerie lui passe la liste de ses photos et
// l'index de celle qu'on a cliquee ; ensuite on circule aux fleches, au clavier
// ou au doigt. Le fond de page est bloque pendant l'ouverture, sinon la page
// defile derriere la photo des qu'on fait glisser.
let visioSrcs = [];
let visioI = 0;
let visioRendu = null;

function visioMontrer(i) {
  if (!visioSrcs.length) return;
  visioI = (i + visioSrcs.length) % visioSrcs.length;
  $("visio-img").src = visioSrcs[visioI];
  $("visio-compte").textContent = `${visioI + 1} / ${visioSrcs.length}`;
  // Une seule photo : les fleches n'ont rien a faire la.
  const seule = visioSrcs.length < 2;
  document.querySelectorAll(".visio-nav").forEach((b) => b.classList.toggle("hidden", seule));
}

function visioOuvrir(srcs, i) {
  visioSrcs = srcs;
  // On se souvient d'ou on vient : a la fermeture, le focus doit revenir sur la
  // vignette cliquee, pas se perdre en haut de page.
  visioRendu = document.activeElement;
  visioMontrer(i);
  $("visio").classList.remove("hidden");
  document.body.classList.add("visio-ouverte");
  $("visio").focus();
}

function visioFermer() {
  $("visio").classList.add("hidden");
  document.body.classList.remove("visio-ouverte");
  $("visio-img").removeAttribute("src");
  if (visioRendu && visioRendu.isConnected) visioRendu.focus();
  visioRendu = null;
}

addEventListener("keydown", (e) => {
  if ($("visio")?.classList.contains("hidden")) return;
  if (e.key === "Escape") return visioFermer();
  if (e.key === "ArrowLeft") return visioMontrer(visioI - 1);
  if (e.key === "ArrowRight") return visioMontrer(visioI + 1);
});

// Glisser d'un doigt pour passer a la photo suivante. Seuil a 45 px : en
// dessous, c'est un tremblement de main, pas une intention.
function visioGlisser() {
  const z = $("visio");
  if (!z || z.dataset.glisse) return;
  z.dataset.glisse = "1";
  let x0 = null;
  z.addEventListener("pointerdown", (e) => (x0 = e.clientX));
  z.addEventListener("pointerup", (e) => {
    if (x0 === null) return;
    const d = e.clientX - x0;
    x0 = null;
    if (Math.abs(d) > 45) visioMontrer(visioI + (d < 0 ? 1 : -1));
  });
}

// ---- Chiffres cles : comptage a l'entree dans l'ecran ----
// Le chiffre grimpe jusqu'a sa valeur quand la tuile apparait. Une seule fois :
// le compteur se retire de l'observation des qu'il a joue.
function animerChiffres() {
  const cibles = [...document.querySelectorAll(".stat-val")];
  if (!cibles.length) return;
  const doux = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const obs = new IntersectionObserver((entrees) => {
    for (const e of entrees) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      obs.unobserve(el);
      const fin = Number(el.dataset.vers);
      if (doux || !Number.isFinite(fin) || fin <= 0) {
        el.textContent = el.dataset.groupe
          ? String(fin || 0).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0") : String(fin || 0);
        continue;
      }
      const DUREE = 900;
      const t0 = performance.now();
      // « 30 000 » doit garder son espace tout le long du comptage, sinon le
      // chiffre se lit « 30000 » pendant une seconde puis change de forme.
      const ecrire = el.dataset.groupe
        ? (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0")
        : (v) => String(v);
      el.textContent = ecrire(0);
      const pas = (t) => {
        const p = Math.min((t - t0) / DUREE, 1);
        // Freinage en fin de course : le chiffre se pose au lieu de s'arreter net.
        el.textContent = ecrire(Math.round(fin * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(pas);
      };
      requestAnimationFrame(pas);
    }
  }, { threshold: 0.4 });
  cibles.forEach((c) => obs.observe(c));
}

// ---- Petit defile de photos dans un split ----
// Un seul minuteur pour toute la page, relance a chaque rendu : les elements
// sont recrees par innerHTML, donc rien ne s'empile d'un rendu a l'autre.
let scrollerMinuteur = null;
function demarrerScrollers() {
  clearInterval(scrollerMinuteur);
  const boites = [...document.querySelectorAll(".split-scroller")];
  if (!boites.length) return;
  const montrer = (b, vers) => {
    const photos = [...b.querySelectorAll(".ss-photo")];
    const points = [...b.querySelectorAll(".ss-dot")];
    const i = photos.findIndex((p) => p.classList.contains("on"));
    const n = ((vers ?? i + 1) + photos.length) % photos.length;
    photos.forEach((p, k) => p.classList.toggle("on", k === n));
    points.forEach((p, k) => p.classList.toggle("on", k === n));
  };
  boites.forEach((b) => b.addEventListener("click", (e) => {
    const d = e.target.closest("[data-ss]");
    if (!d) return;
    montrer(b, +d.dataset.ss);
    // Le visiteur a choisi sa photo : on lui laisse le temps de la regarder.
    b.dataset.pause = "1";
    clearTimeout(b._reprise);
    b._reprise = setTimeout(() => delete b.dataset.pause, 9000);
  }));
  scrollerMinuteur = setInterval(() => boites.forEach((b) => {
    if (!b.dataset.pause && !b.matches(":hover")) montrer(b);
  }), 4200);
}

// ---- Bandeaux de mots-cles : vitesse constante quelle que soit la largeur ----
// La duree etait fixe (28 s) alors que la distance parcourue, elle, depend de
// la largeur du texte : 75 px/s sur un grand ecran mais 47 px/s sur un
// telephone, ou les mots sont plus petits. Sur un ecran trois fois plus etroit,
// cela donnait l'impression que le bandeau ne bougeait pas. On calcule donc la
// duree a partir de la largeur mesuree, pour une vitesse identique partout.
const KW_VITESSE = 75;           // pixels par seconde
const REEL_VITESSE = 55;         // les logos defilent plus posement que les mots
function calerBandeaux() {
  for (const piste of document.querySelectorAll(".kw-piste")) {
    const serie = piste.querySelector(".kw-serie");
    if (!serie) continue;
    const l = serie.getBoundingClientRect().width;
    if (l > 0) piste.style.animationDuration = (l / KW_VITESSE).toFixed(2) + "s";
  }
  for (const piste of document.querySelectorAll(".reel-piste")) {
    const serie = piste.querySelector(".reel-serie");
    if (!serie) continue;
    // Ce sont les logos qui donnent sa largeur a la serie : tant qu'une image
    // n'est pas arrivee, la mesure est fausse. On recalcule a chaque arrivee.
    for (const img of serie.querySelectorAll("img")) {
      if (img.complete || img.dataset.cale) continue;
      img.dataset.cale = "1";
      img.addEventListener("load", calerBandeaux, { once: true });
      img.addEventListener("error", calerBandeaux, { once: true });
    }
    const l = serie.getBoundingClientRect().width;
    if (l <= 0) continue;
    // La piste se translate d'exactement UNE serie, pour que la copie arrive
    // pile ou etait l'originale. La distance est donc mesuree, pas ecrite en
    // dur : a -50 % elle ne tomberait juste qu'avec exactement deux series.
    piste.style.setProperty("--reel-pas", l + "px");
    piste.style.animationDuration = (l / REEL_VITESSE).toFixed(2) + "s";
    garnirReel(piste, l);
  }
}

// Il faut de quoi remplir le cadre PLUS une serie entiere, celle dont on revient
// en arriere a chaque tour. Avec quatorze logos, deux series suffisaient ; avec
// les deux logos de l'academie, la piste ne couvre pas un grand ecran et c'est
// un trou qui defile a la place du bandeau.
const REEL_SERIES_MAX = 12;
function garnirReel(piste, largeurSerie) {
  const vue = piste.parentElement?.clientWidth || 0;
  if (!vue) return;
  const voulu = Math.min(Math.ceil(vue / largeurSerie) + 1, REEL_SERIES_MAX);
  // On recopie la serie DOUBLON (deja masquee aux lecteurs d'ecran et retiree
  // du parcours clavier), jamais l'originale : sinon chaque logo compterait
  // plusieurs fois au clavier.
  const modele = piste.querySelector('.reel-serie[aria-hidden="true"]');
  if (!modele) return;
  while (piste.children.length < voulu) piste.appendChild(modele.cloneNode(true));
}

// Le bandeau du bas de page est le meme pour tous les mondes : on le remplit
// une seule fois, au premier rendu.
function poserPartenaires() {
  const z = $("partners-reel");
  if (!z || z.dataset.pret) return;
  z.dataset.pret = "1";
  z.innerHTML = reelHTML(PARTENAIRES_ACADEMIE);
}

// La page du tournoi porte deja sa propre section « Partenaires », alimentee par
// la meme liste : le bandeau du bas de page y faisait donc doublon, deux fois
// les quatorze memes logos a quelques centimetres d'ecart.
// On teste la presence de la section plutot que le nom du monde : une page qui
// n'a pas de section partenaires (une page de detail, par exemple) garde le
// bandeau du bas, sans qu'on ait a tenir une liste d'exceptions a jour.
function majPartenairesBas() {
  const bas = document.querySelector(".partners");
  if (!bas) return;
  bas.hidden = !!$("world-main")?.querySelector(".sponsors-sec");
}
// Au changement de largeur, les mots changent de taille : on recalcule.
let kwMinuteur = null;
addEventListener("resize", () => {
  clearTimeout(kwMinuteur);
  // En s'elargissant, la fenetre peut avaler le debordement du carrousel : on
  // le regarnit, sinon il se fige sans prevenir.
  kwMinuteur = setTimeout(() => { calerBandeaux(); lancerCarrousel(); }, 200);
});

// ---- Carrousel des programmes ----
// L'avancee est pilotee ici, a une vitesse en pixels par seconde, et non par une
// animation CSS : la duree venait d'un calc() sur une variable personnalisee,
// que les moteurs ne resolvent pas tous pareil — le defilement n'avait donc pas
// la meme allure d'un navigateur a l'autre. On defile la vue plutot que de
// translater la piste, ce qui laisse au visiteur une vraie barre a tirer.
// Secondes par carte : c'est la formule d'origine (duree = nombre de cartes x
// 3.4 s pour parcourir une serie), reprise telle quelle pour garder exactement
// l'allure qu'avait Chrome, a toutes les largeurs d'ecran.
// Le carrousel ne peut avancer que s'il deborde de son cadre : l'avancee se
// fait par scrollLeft, et scrollLeft reste a zero quand tout tient a l'ecran.
// Avec trois cartes doublees, la piste faisait environ 2100 px : sur un ecran
// large, elle tenait entierement dans le cadre et le carrousel restait fige,
// immobile, sans que rien ne le signale. On recopie donc la serie autant de
// fois qu'il faut pour qu'elle deborde toujours d'au moins une serie.
const CAR_SERIES_MAX = 12;            // garde-fou : jamais plus de 12 series
function garnirCarrousel(vue) {
  const piste = vue.querySelector(".carousel-track");
  const n = Number(piste?.dataset.n) || 0;
  if (!n) return;
  const cartes = vue.querySelectorAll(".ccard");
  if (cartes.length <= n) return;
  const serie = cartes[n].offsetLeft - cartes[0].offsetLeft;
  if (serie <= 0) return;
  // Il faut de quoi remplir le cadre PLUS une serie entiere, celle dont on
  // revient en arriere a chaque tour.
  const voulu = Math.min(Math.ceil(vue.clientWidth / serie) + 1, CAR_SERIES_MAX);
  const modele = vue.querySelector(".carousel-clone");
  if (!modele) return;
  let series = Math.round(cartes.length / n);
  while (series < voulu) {
    piste.appendChild(modele.cloneNode(true));
    series++;
  }
}

const CAR_SEC_PAR_CARTE = 3.4;
let carBoucle = null;
function lancerCarrousel() {
  cancelAnimationFrame(carBoucle);
  const doux = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const vues = [...document.querySelectorAll(".carousel")];
  if (!vues.length || doux) return;

  vues.forEach(garnirCarrousel);
  const etats = vues.map((vue) => {
    const cartes = [...vue.querySelectorAll(".ccard")];
    const parSerie = Number(vue.querySelector(".carousel-track")?.dataset.n) || cartes.length / 2;
    const etat = { vue, cartes, parSerie, survol: false, jusqua: 0, reste: 0 };
    // Le visiteur reprend la main : on se tait un moment.
    const main = () => { etat.jusqua = performance.now() + 2500; };
    vue.addEventListener("pointerenter", () => (etat.survol = true));
    vue.addEventListener("pointerleave", () => (etat.survol = false));
    vue.addEventListener("focusin", () => (etat.survol = true));
    vue.addEventListener("focusout", () => (etat.survol = false));
    vue.addEventListener("wheel", main, { passive: true });
    vue.addEventListener("touchstart", main, { passive: true });
    vue.addEventListener("pointerdown", main);
    return etat;
  });

  let precedent = 0;
  const pas = (t) => {
    // Plafonne : apres un onglet en arriere-plan, dt vaudrait plusieurs secondes
    // et le carrousel ferait un bond.
    const dt = precedent ? Math.min((t - precedent) / 1000, 0.05) : 0;
    precedent = t;
    for (const e of etats) {
      if (e.parSerie < 1 || e.survol || t < e.jusqua) continue;
      // Largeur d'une serie, mesuree : la carte n et la carte 0 portent la meme
      // image, donc revenir de cette distance ne se voit pas.
      const serie = e.cartes[e.parSerie].offsetLeft - e.cartes[0].offsetLeft;
      if (serie <= 0) continue;
      // On accumule les fractions : un pas peut faire moins d'un pixel par
      // image, et scrollLeft pourrait les perdre.
      e.reste += (serie / (e.parSerie * CAR_SEC_PAR_CARTE)) * dt;
      const entier = Math.floor(e.reste);
      if (entier) {
        e.reste -= entier;
        e.vue.scrollLeft += entier;
        if (e.vue.scrollLeft >= serie) e.vue.scrollLeft -= serie;
      }
    }
    carBoucle = requestAnimationFrame(pas);
  };
  carBoucle = requestAnimationFrame(pas);
}

function renderWorld(key) {
  const w = WORLDS[key];
  document.body.dataset.world = key;
  document.querySelectorAll(".sw").forEach((b) => b.classList.toggle("active", b.dataset.world === key));
  const ctaHTML = w.cta.map((c) =>
    c.type === "contact" ? `<button class="btn-cta" data-contact="${esc(c.source)}">${esc(c.label)}</button>`
    : c.type === "scroll" ? `<button class="btn-cta" data-scroll="${esc(c.target)}">${esc(c.label)}</button>`
    : `<button class="btn-cta" data-cta="${c.type}">${esc(c.label)}</button>`).join("");
  paintHero({ logo: w.logo, heroLogo: w.heroLogo, hero: w.hero, heroPos: w.heroPos, heroVideo: w.heroVideo, tag: w.tag, slogan: w.slogan, desc: w.desc, ctaHTML });
  $("world-main").innerHTML = w.sections.map(sectionWrap).join("");
  animate();
  demarrerScrollers();
  lancerCarrousel();
  carrInit();
  animerChiffres();
  poserPartenaires();
  majPartenairesBas();
  visioGlisser();
  calerBandeaux();
  calpDates = null; calpJourVu = null;   // on change de monde : on repart propre
  calPubCharger();
}

function renderDetail(id) {
  const d = DETAILS[id];
  const w = WORLDS[d.world];
  document.body.dataset.world = d.world;
  document.querySelectorAll(".sw").forEach((b) => b.classList.toggle("active", b.dataset.world === d.world));
  // Une page de filiere peut porter son propre appel a l'action ; il passe
  // devant le retour, qui devient secondaire.
  const ctaPage = !d.cta ? ""
    : d.cta.scroll ? `<button class="btn-cta" data-scroll="${esc(d.cta.scroll)}">${esc(d.cta.label)}</button>`
    : `<button class="btn-cta" data-contact="${esc(d.cta.contact)}">${esc(d.cta.label)}</button>`;
  const ctaHTML = ctaPage + `<button class="btn-cta ghost" data-back="${d.world}">← Retour ${esc(w.retour)}</button>`;
  // Une page peut porter son propre logo : la Game Zone a le sien.
  paintHero({ logo: w.logo, heroLogo: d.heroLogo || w.heroLogo, hero: d.hero, heroPos: d.heroPos, heroVideo: d.heroVideo, tag: w.tag, slogan: d.title, desc: d.subtitle, ctaHTML, sloganEntier: true });
  $("world-main").innerHTML = d.sections.map(sectionWrap).join("");
  animate();
  demarrerScrollers();
  lancerCarrousel();
  carrInit();
  animerChiffres();
  poserPartenaires();
  majPartenairesBas();
  visioGlisser();
  calerBandeaux();
  if ($("stgp-list")) stgLoad();
  if ($("gz-winners") || $("gz-photos-carousel")) loadGamezone();
}

let revealCheck = null;
function animate() {
  for (const el of [$("hero-content"), $("world-main")]) {
    el.classList.remove("fade-in"); void el.offsetWidth; el.classList.add("fade-in");
  }
  // Révélation au défilement (approche scroll : robuste, jamais de contenu
  // bloqué invisible même si un observer échoue).
  if (revealCheck) window.removeEventListener("scroll", revealCheck);
  const secs = [...document.querySelectorAll("#world-main > section")];
  secs.forEach((s) => s.classList.add("reveal"));
  revealCheck = () => {
    for (const s of secs)
      if (!s.classList.contains("in") && s.getBoundingClientRect().top < window.innerHeight * 0.88) s.classList.add("in");
    if (secs.every((s) => s.classList.contains("in"))) { window.removeEventListener("scroll", revealCheck); revealCheck = null; }
  };
  revealCheck();
  window.addEventListener("scroll", revealCheck, { passive: true });
}

// ===================================================================
//  Routage : deux mondes (Academy, Lausanne Open) + pages de détail.
//  Sur le domaine lausanneopen.ch, le site n'affiche QUE le tournoi (ni barre, ni pied de page),
//  jusqu'à ce que ce domaine soit redirigé vers teamlausanne.ch/#tournoi.
//  Aucune connexion ni réservation sur le site public : l'app vit sur app.teamlausanne.ch.
// ===================================================================
const LO_ONLY = /lausanneopen/i.test(location.hostname);
const DEFAULT_WORLD = LO_ONLY ? "tournoi" : "academie";
if (LO_ONLY) document.body.classList.add("lo-only");
const TITLES = {
  academie: ["Team Lausanne Academy — Tennis à Lausanne, du Kids Tennis au Pro", "Team Lausanne Academy : le centre de formation tennis des Plaines-du-Loup à Lausanne. Kids Tennis, Club, Compétition, Performance, Sport-études, Pro U18, Pro, stages et tournois GameZone."],
  tournoi: ["Lausanne Open — ITF M25, prochaine édition août 2027", "Lausanne Open : l’unique tournoi international de tennis masculin du canton de Vaud. ITF M25, 30 000 $ de dotation, entrée libre. Prochaine édition en août 2027 aux Plaines-du-Loup."],
};
function setTitle(world, sub) {
  const t = TITLES[world] || TITLES.academie;
  document.title = sub ? `${sub} — ${world === "tournoi" ? "Lausanne Open" : "Team Lausanne Academy"}` : t[0];
  const m = document.querySelector('meta[name="description"]'); if (m) m.setAttribute("content", t[1]);
  // Texte du formulaire « Nous écrire » selon le monde affiché
  const cs = document.querySelector("#contact-lo .wsec-sub");
  if (cs) cs.textContent = world === "tournoi"
    ? "Une question sur le Lausanne Open, une demande de presse, un partenariat — écrivez-nous, nous répondons rapidement."
    : "Une question sur l'Academy — écrivez-nous, nous répondons rapidement.";
}
function route() {
  const h = location.hash.replace("#", "");
  hit("site", h || "accueil");
  if (DETAILS[h] && WORLDS[DETAILS[h].world] && (!LO_ONLY || DETAILS[h].world === "tournoi")) { renderDetail(h); setTitle(DETAILS[h].world, DETAILS[h].title); }
  else if (WORLDS[h] && !LO_ONLY) { renderWorld(h); setTitle(h); }
  else { renderWorld(DEFAULT_WORLD); setTitle(DEFAULT_WORLD); }
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  annonceAccueil();
}

// ---- Calendrier public de la saison ----
// Les dates viennent d'agenda_public(), une fonction SECURITY DEFINER qui ne
// renvoie QUE le public. Le site ne lit jamais cal_events : cette table
// contient les vacances de l'équipe et des rendez-vous nominatifs avec des
// familles. Le tri est fait en base, pas ici.
var CALP_GENRES = [
  ["stage", "Stage"],
  ["fermeture", "Académie fermée"],
  ["vacances-scolaires", "Vacances scolaires"],
  ["ferie", "Jour férié"],
  ["evenement", "Événement"],
];
var CALP_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
var calpDates = null, calpMois = null, calpMin = null, calpMax = null, calpJourVu = null;

// Dates manipulées en texte « AAAA-MM-JJ » et jamais en objet Date : une borne
// de vacances comparée en UTC se décale d'un jour pour qui lit depuis Lausanne.
const calpISO = (a, m, j) =>
  `${a}-${String(m + 1).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
const calpAujourdHui = () => { const d = new Date(); return calpISO(d.getFullYear(), d.getMonth(), d.getDate()); };
const calpJoursDansMois = (a, m) => new Date(a, m + 1, 0).getDate();
// JS compte la semaine à partir de dimanche ; en Suisse elle commence lundi.
const calpPremierCase = (a, m) => (new Date(a, m, 1).getDay() + 6) % 7;
const calpFrDate = (iso) => {
  const [a, m, j] = iso.split("-").map(Number);
  return `${j} ${CALP_MOIS[m - 1]} ${a}`;
};
// « Du 5 au 11 octobre 2026 » plutôt que de répéter le mois et l'année des deux
// côtés ; on ne les redit que lorsqu'ils changent.
const calpPeriode = (d, f) => {
  if (d === f) return calpFrDate(d);
  const [a1, m1, j1] = d.split("-").map(Number);
  const [a2, m2] = f.split("-").map(Number);
  if (a1 === a2 && m1 === m2) return `Du ${j1} au ${calpFrDate(f)}`;
  if (a1 === a2) return `Du ${j1} ${CALP_MOIS[m1 - 1]} au ${calpFrDate(f)}`;
  return `Du ${calpFrDate(d)} au ${calpFrDate(f)}`;
};

async function calPubCharger() {
  if (!document.getElementById("calp-grille")) return;
  if (calpDates) { calpRendre(); return; }
  const d = new Date();
  const du = calpISO(d.getFullYear(), d.getMonth(), 1);
  const au = calpISO(d.getFullYear() + 1, d.getMonth(), calpJoursDansMois(d.getFullYear() + 1, d.getMonth()));
  const { data, error } = await sb.rpc("agenda_public", { p_du: du, p_au: au });
  if (error) {
    document.getElementById("calp-liste").innerHTML =
      '<p class="muted">Le calendrier n\'a pas pu être chargé. Réessayez plus tard.</p>';
    return;
  }
  calpDates = data || [];
  calpMin = du.slice(0, 7);
  calpMax = au.slice(0, 7);
  calpMois = calpMin;
  calpRendre();
}

// Entrées couvrant un jour donné, dans l'ordre de la légende : ce qui demande
// une action (stage, fermeture) passe avant le décor (vacances, férié).
function calpDuJour(iso) {
  const rang = (g) => CALP_GENRES.findIndex(([k]) => k === g);
  return (calpDates || []).filter((e) => e.debut <= iso && iso <= e.fin)
    .sort((a, b) => rang(a.genre) - rang(b.genre));
}

function calpRendre() {
  const grille = document.getElementById("calp-grille"); if (!grille) return;
  const [a, m] = calpMois.split("-").map(Number);
  const an = a, mois = m - 1;
  document.getElementById("calp-mois").textContent = `${CALP_MOIS[mois]} ${an}`;
  document.querySelectorAll("[data-calp]").forEach((b) => {
    const cible = calpDecaler(calpMois, Number(b.dataset.calp));
    b.disabled = cible < calpMin || cible > calpMax;
  });

  const auj = calpAujourdHui();
  let html = "";
  for (let i = 0; i < calpPremierCase(an, mois); i++) html += '<span class="calp-vide"></span>';
  for (let j = 1; j <= calpJoursDansMois(an, mois); j++) {
    const iso = calpISO(an, mois, j);
    const evs = calpDuJour(iso);
    const cls = ["calp-c"].concat(evs.map((e) => "calp-g-" + e.genre));
    if (iso === auj) cls.push("calp-auj");
    if (iso === calpJourVu) cls.push("calp-sel");
    if (!evs.length) {
      html += `<span class="${cls.join(" ")}"><b>${j}</b></span>`;
    } else {
      const quoi = evs.map((e) => e.titre).join(", ");
      html += `<button type="button" class="${cls.join(" ")}" data-calp-jour="${iso}"
        aria-label="${esc(calpFrDate(iso))} — ${esc(quoi)}"><b>${j}</b>
        <span class="calp-pts" aria-hidden="true">${evs.slice(0, 3).map((e) =>
          `<i class="calp-pt calp-g-${e.genre}"></i>`).join("")}</span></button>`;
    }
  }
  grille.innerHTML = html;
  calpListe();
}

const calpDecaler = (ym, n) => {
  const [a, m] = ym.split("-").map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Sous la grille : le détail. Un jour choisi prend toute la place, sinon on
// liste le mois — sur téléphone, c'est cette liste qui se lit vraiment.
function calpListe() {
  const L = document.getElementById("calp-liste"); if (!L) return;
  let titre, lot;
  if (calpJourVu && calpJourVu.slice(0, 7) === calpMois) {
    titre = calpFrDate(calpJourVu);
    lot = calpDuJour(calpJourVu);
  } else {
    const [a, m] = calpMois.split("-").map(Number);
    const fin = calpISO(a, m - 1, calpJoursDansMois(a, m - 1));
    titre = `${CALP_MOIS[m - 1]} ${a}`;
    const rang = (g) => CALP_GENRES.findIndex(([k]) => k === g);
    lot = (calpDates || []).filter((e) => e.debut <= fin && e.fin >= `${calpMois}-01`)
      .sort((x, y) => x.debut.localeCompare(y.debut) || rang(x.genre) - rang(y.genre));
  }
  if (!lot.length) {
    L.innerHTML = `<p class="calp-rien">Rien de particulier en ${esc(titre.toLowerCase())}.</p>`;
    return;
  }
  L.innerHTML = `<h3 class="calp-liste-t">${esc(titre)}</h3>
    <ul class="calp-items">${lot.map((e) => {
      const quand = calpPeriode(e.debut, e.fin);
      const lien = e.genre === "stage"
        ? ' <button type="button" class="calp-lien" data-scroll-page="stages">Voir les stages</button>' : "";
      return `<li class="calp-item calp-g-${e.genre}">
        <span class="calp-quand">${esc(quand)}</span>
        <b class="calp-titre">${esc(e.titre)}</b>
        ${e.detail ? `<span class="calp-detail">${esc(e.detail)}</span>` : ""}${lien}</li>`;
    }).join("")}</ul>`;
}

// ---- Annonce temporaire sur l'accueil ----
// Un encart daté : passé `au`, il ne s'affiche plus de lui-même, rien à aller
// débrancher. Les dates sont celles du calendrier de la console (fermeture du
// 5 au 11 octobre, camps d'automne les deux semaines suivantes).
// La précision sur le mercredi 7 n'est pas un détail : ce rendez-vous tombe
// pendant la fermeture et les familles viennent de confirmer leur présence par
// retour de mail. Sans cette ligne, « fermé » le ferait passer pour annulé.
const ANNONCE = {
  cle: "tla-annonce-automne-2026",        // mémoire du ✕, propre à cette annonce
  du: "2026-10-01", au: "2026-10-04",     // bornes incluses
  oeil: "Information",
  titre: "École de Tennis fermée du 5 au 11 octobre",
  corps: "Pas de cours de l'École de Tennis la semaine prochaine. Les stages d'automne prennent le relais :",
  dates: ["Semaine 1 — du 12 au 16 octobre", "Semaine 2 — du 19 au 23 octobre"],
  precision: "Les cours privés et le rendez-vous Compétition / Performance du mercredi 7 octobre sont maintenus.",
  bouton: "Voir les stages d'automne",
  cible: "stages",
};
// Date du jour côté visiteur, en heure locale : toISOString() renvoie l'UTC et
// ferait apparaître ou disparaître l'encart une heure trop tôt.
const jourLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function annonceFermee() {
  // localStorage jette dans certains contextes (navigation privée verrouillée) :
  // en cas de doute, on montre l'annonce plutôt que de la perdre.
  try { return localStorage.getItem(ANNONCE.cle) === "1"; } catch (e) { return false; }
}
function annonceAccueil() {
  const deja = document.getElementById("annonce");
  const j = jourLocal();
  const montrer = !LO_ONLY
    && (!location.hash || location.hash === "#academie")
    && j >= ANNONCE.du && j <= ANNONCE.au
    && !annonceFermee();
  if (!montrer) { deja?.remove(); return; }
  if (deja) return;

  const el = document.createElement("aside");
  el.id = "annonce"; el.className = "annonce"; el.setAttribute("role", "status");
  el.setAttribute("aria-labelledby", "annonce-t");
  el.innerHTML = `
    <button type="button" class="annonce-x" aria-label="Fermer cette annonce">✕</button>
    <span class="annonce-oeil">${esc(ANNONCE.oeil)}</span>
    <h2 id="annonce-t" class="annonce-t">${esc(ANNONCE.titre)}</h2>
    <p class="annonce-corps">${esc(ANNONCE.corps)}</p>
    <ul class="annonce-dates">${ANNONCE.dates.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
    <p class="annonce-prec">${esc(ANNONCE.precision)}</p>
    <button type="button" class="contact-cta annonce-cta">${esc(ANNONCE.bouton)}</button>`;
  document.body.appendChild(el);

  el.querySelector(".annonce-x").addEventListener("click", () => {
    el.remove();
    try { localStorage.setItem(ANNONCE.cle, "1"); } catch (e) {}
  });
  el.querySelector(".annonce-cta").addEventListener("click", () => {
    el.remove();                       // on ne la referme pas définitivement :
    location.hash = ANNONCE.cible;     // elle a fait son travail pour cette fois.
  });
}

// ---- Contact : le formulaire « Nous écrire » en bas de page ----
function openContact(source) {
  const t = $("contact-lo"); if (!t) return;
  const sel = t.querySelector('input[name="nom"]');
  const msg = t.querySelector('textarea[name="message"]');
  if (msg && source && !msg.value) msg.value = source + " : ";
  t.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => sel?.focus(), 600);
}

// ---- Inscription à un stage (page détail #stages) ----
let stgCats = {}, stgSessions = [], stgCurrent = null, stgLinks = {};
const stgDays = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
// Saison d'un stage, deduite du mois : c'est ainsi que les familles en parlent
// (« le stage d'automne »), plus parlant qu'une date seule.
const stgSaison = (d) => {
  const m = new Date(d).getMonth() + 1;
  return m <= 2 || m === 12 ? "Hiver" : m <= 5 ? "Printemps" : m <= 8 ? "Été" : "Automne";
};
const stgEff = (p, d) => Math.round(Number(p) * Math.min(d, 5) / 5 * 100) / 100;

async function stgLoad() {
  const [{ data: cs }, { data: ss }, { data: links }] = await Promise.all([
    sb.from("stage_categories").select("*"),
    sb.from("stage_sessions").select("*").order("start_date"),
    sb.from("stage_session_categories").select("session_id,category_id"),
  ]);
  stgCats = {};
  for (const c of cs || []) stgCats[c.id] = c;
  stgLinks = {};
  for (const l of links || []) (stgLinks[l.session_id] = stgLinks[l.session_id] || []).push(l.category_id);
  // On n'affiche que les stages ayant au moins une catégorie ouverte
  stgSessions = (ss || []).filter((s) => (stgLinks[s.id] || []).length);
  stgRenderList();
}
// Catégories ouvertes d'un stage (objets), triées par prix
function stgOpenCats(s) {
  return (stgLinks[s.id] || []).map((id) => stgCats[id]).filter(Boolean).sort((a, b) => (a.price || 0) - (b.price || 0));
}
function stgRenderList() {
  const L = $("stgp-list"); if (!L) return;
  if (!stgSessions.length) { L.innerHTML = '<p class="muted">Aucun stage ouvert aux inscriptions pour le moment. Reviens bientôt !</p>'; return; }
  L.innerHTML = stgSessions.map((s) => {
    const d = stgDays(s.start_date, s.end_date);
    const oc = stgOpenCats(s);
    const prices = oc.map((c) => stgEff(c.price || 0, d));
    const priceLbl = prices.length ? (Math.min(...prices) === Math.max(...prices) ? `${prices[0]} CHF` : `dès ${Math.min(...prices)} CHF`) : "—";
    const img = s.image_url || oc.find((c) => c.image_url)?.image_url;
    const dates = s.start_date === s.end_date ? frDate(s.start_date) : `${frDate(s.start_date)} → ${frDate(s.end_date)}`;
    const badges = oc.map((c) => `<span class="stg-tag">${esc(c.name)}</span>`).join("");
    return `<article class="stg-pub-card" data-stg="${s.id}">
      <span class="stg-saison">${esc(stgSaison(s.start_date))}</span>
      ${img ? `<img src="${img}" alt="" class="stg-pub-img" loading="lazy"/>` : '<div class="stg-pub-img stg-pub-noimg"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M4.7 6.5c3.2 2 3.2 9 0 11M19.3 6.5c-3.2 2-3.2 9 0 11"/></svg></div>'}
      <div class="stg-pub-body"><h3>${esc(s.title || "Stage")}</h3>
        <div class="stg-pub-dates">${dates} · ${jours(d)}</div>
        <div class="stg-pub-badges">${badges}</div>
        <div class="stg-pub-foot"><span class="stg-pub-price">${priceLbl}</span>
          <button class="stg-pub-cta" data-stg="${s.id}">S'inscrire</button></div></div></article>`;
  }).join("");
  // La carte entiere ouvre le formulaire : viser un petit bouton au doigt est
  // inutilement penible. Le bouton reste, c'est lui qui porte l'acces clavier.
  L.querySelectorAll(".stg-pub-card").forEach((c) =>
    c.addEventListener("click", () => stgOpenForm(c.dataset.stg)));
}
// Applique la catégorie choisie : prix + champs conditionnels
function stgApplyCat() {
  const c = stgCats[$("f-category").value] || {};
  const d = stgDays(stgCurrent.start_date, stgCurrent.end_date), base = stgEff(c.price || 0, d);
  const addon = Number(c.private_addon_price) || 0;
  // Option heures privées (ex. « Entraîne-toi comme un pro »)
  $("f-addon-wrap").classList.toggle("hidden", !addon);
  if (addon) $("f-addon-label").textContent = `Ajouter 3h de tennis privé (+${addon} CHF)`;
  else $("f-addon").checked = false;
  const price = base + (addon && $("f-addon").checked ? addon : 0);
  const dates = `${frDate(stgCurrent.start_date)}${stgCurrent.end_date !== stgCurrent.start_date ? " → " + frDate(stgCurrent.end_date) : ""}`;
  $("stgp-modal-meta").innerHTML = `${dates} · ${jours(d)} · <b>${price} CHF</b>`;
  $("f-cat-info").textContent = [c.meal ? "repas inclus" : "", c.tshirt ? "t-shirt offert" : ""].filter(Boolean).join(" · ");
  $("f-tshirt-wrap").classList.toggle("hidden", !c.tshirt);
  $("f-meal-wrap").classList.toggle("hidden", !c.meal);
  $("f-ranking-wrap").classList.toggle("hidden", !c.ask_ranking);
}
function stgOpenForm(id) {
  stgCurrent = stgSessions.find((s) => s.id === id);
  const oc = stgOpenCats(stgCurrent);
  $("stgp-modal-title").textContent = stgCurrent.title || "Stage";
  $("f-category").innerHTML = oc.map((c) => `<option value="${c.id}">${esc(c.name)} — ${stgEff(c.price || 0, stgDays(stgCurrent.start_date, stgCurrent.end_date))} CHF</option>`).join("");
  $("stgp-form").reset(); $("f-meal-text").disabled = true;
  stgApplyCat();
  $("stgp-form").classList.remove("hidden"); $("stgp-done").classList.add("hidden"); $("stgp-error").hidden = true;
  $("stgp-modal").classList.remove("hidden");
}
function stgCloseForm() { $("stgp-modal").classList.add("hidden"); stgCurrent = null; }
$("stgp-close").addEventListener("click", stgCloseForm);
$("stgp-modal").addEventListener("click", (e) => { if (e.target === $("stgp-modal")) stgCloseForm(); });
$("f-category").addEventListener("change", stgApplyCat);
$("f-addon").addEventListener("change", stgApplyCat);
document.addEventListener("change", (e) => { if (e.target.name === "meal") $("f-meal-text").disabled = e.target.value !== "autre"; });
$("stgp-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("stgp-error"); err.hidden = true;
  const c = stgCats[$("f-category").value] || {};
  if (!c.id) { err.textContent = "Choisis une catégorie."; err.hidden = false; return; }
  let meal = null;
  if (c.meal) { const sel = document.querySelector('input[name="meal"]:checked')?.value; meal = sel === "autre" ? ($("f-meal-text").value.trim() || "À préciser") : "Aucune"; }
  const addon = Number(c.private_addon_price) || 0;
  const row = { stage_id: stgCurrent.id, category_id: c.id,
    first_name: $("f-first").value.trim(), last_name: $("f-last").value.trim(),
    email: $("f-email").value.trim(), birth_date: $("f-birth").value || null,
    tshirt_size: c.tshirt ? ($("f-tshirt").value || null) : null, meal_restriction: meal,
    ranking: c.ask_ranking ? ($("f-ranking").value.trim() || null) : null,
    private_addon: addon > 0 && $("f-addon").checked,
    comment: $("f-comment").value.trim() || null };
  const btn = e.target.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Envoi…";
  const { error } = await sb.from("stage_registrations").insert(row);
  if (error) {
    // 23505 = l'index unique stage_registrations_pas_deux_fois (db/142). Un
    // parent doit lire une phrase, pas le jargon de Postgres.
    err.textContent = error.code === "23505"
      ? "Cet enfant est déjà inscrit à ce stage dans cette catégorie. Si c'est une erreur, écrivez-nous à info@teamlausanne.ch."
      : "Erreur : " + error.message;
    err.hidden = false; btn.disabled = false; btn.textContent = "Envoyer mon inscription"; return;
  }
  $("stgp-form").classList.add("hidden"); $("stgp-done").classList.remove("hidden");
});

// ---- GameZone : photos (carrousel animé) + tableau des vainqueurs ----
const GZ_CUP = (color, size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M8 4h8v4.5a4 4 0 0 1-8 0V4z"/><path d="M8 5.5H5V7a3 3 0 0 0 3 3M16 5.5h3V7a3 3 0 0 1-3 3"/><path d="M10 13.5V16h4v-2.5M8 20h8M12 16v4"/></svg>`;
const gzCups = (w) => (w >= 10 ? GZ_CUP("#c8901f", 18) : w >= 5 ? GZ_CUP("#9aa3ad", 16) : "");

// Uniquement la saison EN COURS (la RPC la renvoie toujours, même sans tournoi encore importé).
async function loadGamezone() {
  const { data: seasons } = await sb.rpc("gz_public_seasons");
  const cur = (seasons || []).find((s) => s.is_current) || (seasons || [])[0];
  const seasonId = cur ? cur.id : null;
  loadGzPhotos(seasonId);
  loadGzWinners(seasonId);
}


// Photos des vainqueurs : clic → agrandissement plein écran (flèches, clavier ← → Échap, glisser au doigt).
function gzBindLightbox(wrap, urls) {
  wrap.onclick = (e) => {   // onclick (et pas addEventListener) : la liste est re-rendue à chaque changement de saison
    const img = e.target.closest("img"); if (!img) return;
    gzOpenLightbox(urls, Math.max(0, urls.indexOf(img.getAttribute("src"))));
  };
}
function gzOpenLightbox(urls, start) {
  let i = start;
  const ov = document.createElement("div");
  ov.className = "gz-lb";
  ov.innerHTML = `<button type="button" class="gz-lb-x" aria-label="Fermer">✕</button>
    <button type="button" class="gz-lb-nav gz-lb-prev" aria-label="Photo précédente">‹</button>
    <img class="gz-lb-img" alt="Vainqueur GameZone" />
    <button type="button" class="gz-lb-nav gz-lb-next" aria-label="Photo suivante">›</button>
    <div class="gz-lb-count"></div>`;
  const img = ov.querySelector(".gz-lb-img"), count = ov.querySelector(".gz-lb-count");
  const show = (n) => { i = (n + urls.length) % urls.length; img.src = urls[i]; count.textContent = `${i + 1} / ${urls.length}`; };
  const close = () => { document.removeEventListener("keydown", onKey); document.removeEventListener("wheel", noScroll); document.removeEventListener("touchmove", noScroll); ov.remove(); };
  const onKey = (e) => { if (e.key === "Escape") close(); else if (e.key === "ArrowLeft") show(i - 1); else if (e.key === "ArrowRight") show(i + 1); };
  if (urls.length < 2) ov.classList.add("gz-lb-single");
  ov.addEventListener("click", (e) => {
    if (e.target.closest(".gz-lb-prev")) show(i - 1);
    else if (e.target.closest(".gz-lb-next")) show(i + 1);
    else if (e.target !== img) close();
  });
  let x0 = null;
  ov.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  ov.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
  });
  document.addEventListener("keydown", onKey);
  // Pas de body{overflow:hidden} : sur ce site, ça ramène la page en haut (le body fait la hauteur de l'écran) et la
  // visionneuse semblait ne pas s'ouvrir. On bloque la molette et le glisser à la place, tant qu'elle est ouverte.
  const noScroll = (e) => { if (!e.target.closest(".gz-lb")) e.preventDefault(); };
  document.addEventListener("wheel", noScroll, { passive: false });
  document.addEventListener("touchmove", noScroll, { passive: false });
  document.body.appendChild(ov);
  show(i);
}
async function loadGzPhotos(seasonId) {
  const wrap = $("gz-photos-carousel"); if (!wrap) return;
  const { data } = await sb.rpc("gz_public_winner_photos", { p_season: seasonId });
  const rows = data || [];
  if (!rows.length) { wrap.innerHTML = `<p class="muted">Les photos des vainqueurs apparaîtront ici.</p>`; return; }
  const imgs = rows.map((p) => `<div class="gzc-card"><img src="${esc(p.photo_url)}" loading="lazy" alt="Vainqueur GameZone"/></div>`).join("");
  // Peu de photos → statique (pas de duplication ni d'animation) ; sinon défilement animé.
  if (rows.length < 5) wrap.innerHTML = `<div class="gzc-track gzc-static">${imgs}</div>`;
  else wrap.innerHTML = `<div class="gzc-track">${imgs}${imgs}</div>`;
  gzBindLightbox(wrap, rows.map((p) => p.photo_url));
}

async function loadGzWinners(seasonId) {
  const box = $("gz-winners"); if (!box) return;
  const { data, error } = await sb.rpc("gz_public_ranking", { p_season: seasonId });
  const rows = error ? [] : (data || []);
  if (!rows.length) { box.innerHTML = `<p class="muted">Pas encore de vainqueur cette saison.</p>`; return; }
  const PREVIEW = 10;
  const tr = (r, hidden) => `<tr${hidden ? ' class="gzw-hidden hidden"' : ""}><td>${esc(r.first_name)} ${esc(r.last_name)}</td><td>${gzCups(Number(r.wins))} ${r.wins}</td></tr>`;
  const body = rows.map((r, i) => tr(r, i >= PREVIEW)).join("");
  const hasMore = rows.length > PREVIEW;
  box.innerHTML = `<table class="ranking"><thead><tr><th>Vainqueur</th><th>Victoires</th></tr></thead><tbody>${body}</tbody></table>
    ${hasMore ? `<button type="button" id="gzw-more-btn" class="gz-showall">+ Afficher tous les vainqueurs (${rows.length})</button>` : ""}`;
  const btn = $("gzw-more-btn");
  if (btn) btn.addEventListener("click", () => { box.querySelectorAll(".gzw-hidden").forEach((el) => el.classList.remove("hidden")); btn.remove(); });
}

// ===================================================================
//  Interactions globales (délégation)
// ===================================================================
// Un choix dans le menu deroulant le referme. Il s'ouvre au survol ET au focus :
// apres le clic, le lien garde le focus et la souris n'a pas bouge, donc le menu
// restait pose sur la page qu'on venait de demander. On le neutralise par une
// classe, levee des que le pointeur quitte le bloc ou y revient — au doigt,
// aucun des deux n'arrive, et c'est tant mieux : il n'y a pas de survol a
// annuler.
document.addEventListener("click", (e) => {
  const lien = e.target.closest(".sw-menu a");
  const wrap = lien && lien.closest(".sw-wrap");
  if (!wrap) return;
  lien.blur();
  wrap.classList.add("sw-ferme");
  const rouvrir = () => {
    wrap.classList.remove("sw-ferme");
    wrap.removeEventListener("pointerleave", rouvrir);
    wrap.removeEventListener("pointerenter", rouvrir);
  };
  wrap.addEventListener("pointerleave", rouvrir);
  wrap.addEventListener("pointerenter", rouvrir);
});

document.addEventListener("click", (e) => {
  // Onglets du haut / étapes du pied de page : changement de monde (Academy ↔ Lausanne Open).
  const sw = e.target.closest(".sw[data-world], .flow-step[data-world]");
  if (sw) {
    if (LO_ONLY) return;
    // Mobile / écran tactile : le 1er tap sur un onglet ouvre sa liste d'accès directs, le 2e tap navigue.
    const wrap = sw.closest(".sw-wrap"), menu = wrap?.querySelector(".sw-menu");
    const touch = window.matchMedia("(hover: none)").matches || window.innerWidth <= 760;
    if (menu && touch && !wrap.classList.contains("open")) {
      document.querySelectorAll(".sw-wrap.open").forEach((w) => w.classList.remove("open"));
      wrap.classList.add("open");
      return;
    }
    document.querySelectorAll(".sw-wrap.open").forEach((w) => w.classList.remove("open"));
    location.hash = sw.dataset.world; return;
  }
  // Tap ailleurs : referme les listes ouvertes (les liens de la liste naviguent normalement).
  if (!e.target.closest(".sw-wrap")) document.querySelectorAll(".sw-wrap.open").forEach((w) => w.classList.remove("open"));
  else if (e.target.closest(".sw-menu a")) setTimeout(() => document.querySelectorAll(".sw-wrap.open").forEach((w) => w.classList.remove("open")), 50);
  // Calendrier : navigation de mois, choix d'un jour, renvoi vers les stages.
  const cnav = e.target.closest("[data-calp]");
  if (cnav) { calpJourVu = null; calpMois = calpDecaler(calpMois, Number(cnav.dataset.calp)); calpRendre(); return; }
  const cjour = e.target.closest("[data-calp-jour]");
  if (cjour) {
    // Recliquer le même jour revient au mois entier : pas de cul-de-sac.
    calpJourVu = calpJourVu === cjour.dataset.calpJour ? null : cjour.dataset.calpJour;
    calpRendre(); return;
  }
  const cpage = e.target.closest("[data-scroll-page]");
  if (cpage) { location.hash = cpage.dataset.scrollPage; return; }
  // Fiches des coachs. La fermeture passe avant l'ouverture : le voile couvre la
  // page, et un clic dessus ne doit pas rouvrir la carte qui se trouve dessous.
  if (e.target.closest("[data-cch-fermer]")) { coachFermer(); return; }
  const carte = e.target.closest("[data-cch]");
  if (carte) {
    // On revient toujours sur le bouton, jamais sur la carte : c'est lui qui
    // peut recevoir le focus.
    coachAppelante = carte.querySelector(".cch-plus");
    coachOuvrir(carte.dataset.cch);
    return;
  }

  const contact = e.target.closest("[data-contact]");
  if (contact) { openContact(contact.dataset.contact); return; }
  const cta = e.target.closest("[data-cta]");
  if (cta) {
    // La valeur est la clef de la page visee : toute page existante est
    // atteignable, sans ajouter un cas ici a chaque nouveau bouton.
    const t = cta.dataset.cta;
    if (DETAILS[t]) location.hash = t;
    return;
  }
  const plan = e.target.closest("[data-plan]");
  if (plan) { $("plan-img").src = plan.dataset.plan; $("plan-modal").classList.remove("hidden"); return; }
  // Boutons de la visionneuse.
  const vb = e.target.closest("[data-visio]");
  if (vb) {
    const q = vb.dataset.visio;
    if (q === "fermer") visioFermer();
    else visioMontrer(visioI + (q === "suiv" ? 1 : -1));
    return;
  }
  // Clic sur le fond (et non sur la photo ni sur un bouton) : on ferme.
  if (e.target.id === "visio") { visioFermer(); return; }
  // Vignette d'une galerie : on ouvre la visionneuse sur cette photo.
  const vign = e.target.closest(".gphoto");
  if (vign) {
    const gal = vign.closest(".gal");
    try { visioOuvrir(JSON.parse(gal.dataset.srcs), Number(vign.dataset.i) || 0); }
    catch { /* donnees illisibles : mieux vaut ne rien ouvrir que casser la page */ }
    return;
  }
  // Carte de tete de serie : le clic ouvre la biographie. Au doigt il n'y a
  // pas de survol, c'est donc le seul moyen de la lire. Une seule ouverte a la
  // fois : deux cartes deployees cote a cote se marchent dessus.
  const pcard = e.target.closest(".pcard");
  if (pcard) {
    const ouvre = !pcard.classList.contains("on");
    for (const c of document.querySelectorAll(".pcard.on")) {
      c.classList.remove("on");
      c.setAttribute("aria-expanded", "false");
    }
    pcard.classList.toggle("on", ouvre);
    pcard.setAttribute("aria-expanded", String(ouvre));
    return;
  }
  const scroll = e.target.closest("[data-scroll]");
  if (scroll) {
    // la cible peut etre designee par sa classe, son identifiant ou l'ancre
    // d'une section (data-anchor), la seule que portent les sections generees
    const t = scroll.dataset.scroll;
    (document.querySelector("." + t) || document.getElementById(t)
      || document.querySelector(`[data-anchor="${t}"]`))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const goto = LO_ONLY ? null : e.target.closest("[data-goto]");   // menu déroulant : aller à une section d'un monde
  if (goto) {
    const w = goto.dataset.goto, a = goto.dataset.anchor;
    history.replaceState(null, "", "#" + w);
    renderWorld(w);
    requestAnimationFrame(() => document.querySelector(`[data-anchor="${a}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return;
  }
  const back = e.target.closest("[data-back]");
  if (back) { location.hash = back.dataset.back; return; }
  // navigation entre mondes desactivee : ce site ne montre que le tournoi
});

// Popup "Plan des courts" : fermeture
$("plan-close").addEventListener("click", () => $("plan-modal").classList.add("hidden"));
$("plan-modal").addEventListener("click", (e) => { if (e.target === $("plan-modal")) $("plan-modal").classList.add("hidden"); });

// Formulaire de demande d'adhésion (page "Devenir membre")
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "member-form") return;
  e.preventDefault();
  if (!$("m-consent").checked) { const er = $("m-error"); er.textContent = "Merci d'accepter le règlement du club."; er.hidden = false; return; }
  const err = $("m-error"); err.hidden = true;
  const btn = $("m-btn"); btn.disabled = true; btn.textContent = "Envoi…";
  const v = (id) => $(id).value.trim();
  const msg = [
    "Téléphone : " + v("m-phone"),
    "Date de naissance : " + v("m-birth"),
    "Adresse : " + v("m-address") + ", " + v("m-npa") + " " + v("m-city"),
    "Règlement du club : accepté ✔",
    v("m-message") ? "\nMessage : " + v("m-message") : "",
  ].join("\n");
  const { error } = await sb.from("contact_messages").insert({
    source: "Adhésion — Club",
    name: v("m-first") + " " + v("m-last"),
    email: v("m-email"),
    message: msg,
  });
  btn.disabled = false; btn.textContent = "Envoyer ma demande d'adhésion";
  if (error) { err.textContent = "Erreur : " + error.message; err.hidden = false; return; }
  $("member-form").classList.add("hidden");
  $("m-done").classList.remove("hidden");
});

// Formulaire de contact business (en bas de la page "business")
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "biz-form") return;
  e.preventDefault();
  const err = $("biz-error"); err.hidden = true;
  const btn = $("biz-btn"); btn.disabled = true; btn.textContent = "Envoi…";
  const parts = [];
  if ($("biz-company").value.trim()) parts.push("Entreprise / fonction : " + $("biz-company").value.trim());
  if ($("biz-phone").value.trim()) parts.push("Téléphone : " + $("biz-phone").value.trim());
  const m = $("biz-message").value.trim();
  if (m) { if (parts.length) parts.push(""); parts.push(m); }
  const { error } = await sb.from("contact_messages").insert({
    source: "Business — " + $("biz-subject").value,
    name: $("biz-name").value.trim(),
    email: $("biz-email").value.trim(),
    message: parts.join("\n") || null,
  });
  btn.disabled = false; btn.textContent = "Envoyer ma demande";
  if (error) { err.textContent = "Erreur : " + error.message; err.hidden = false; return; }
  $("biz-form").classList.add("hidden");
  $("biz-done").classList.remove("hidden");
});

// Demande d'inscription (pages de filière : Compétition, Performance, Club, Kids Tennis)
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "enroll-form") return;
  e.preventDefault();
  const err = $("en-error"); err.hidden = true;
  const btn = $("en-btn"); btn.disabled = true; btn.textContent = "Envoi…";
  const v = (id) => ($(id) ? $(id).value.trim() : "");
  // Formulaire adultes : formule + fréquence + disponibilités rangées dans le commentaire (même table, tag « adultes »).
  const adult = [v("en-formule") ? "Formule : " + v("en-formule") : "", v("en-freq") ? "Fréquence : " + v("en-freq") : "", v("en-dispo") ? "Disponibilités : " + v("en-dispo") : ""].filter(Boolean);
  const comment = [...adult, v("en-comment")].filter(Boolean).join("\n") || null;
  const row = {
    filiere: e.target.dataset.filiere,
    first_name: v("en-first"), last_name: v("en-last"),
    birthdate: $("en-birth") ? ($("en-birth").value || null) : null,
    avs: v("en-avs") || null, phone: v("en-phone") || null, email: v("en-email") || null,
    ranking: $("en-ranking") ? (v("en-ranking") || null) : null,
    comment,
  };
  const { error } = await sb.from("enrollment_requests").insert(row);
  btn.disabled = false; btn.textContent = e.target.dataset.filiere === "adultes" ? "Envoyer ma demande" : "Envoyer ma demande d'inscription";
  if (error) { err.textContent = "Erreur : " + error.message; err.hidden = false; return; }
  $("enroll-form").classList.add("hidden");
  $("en-done").classList.remove("hidden");
});

window.addEventListener("hashchange", route);
route();

// Arrivée depuis une autre page avec ?at=<ancre> : défiler vers la section.
(() => {
  const at = new URLSearchParams(location.search).get("at");
  if (!at) return;
  requestAnimationFrame(() => document.querySelector(`[data-anchor="${at}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  history.replaceState(null, "", location.pathname + location.hash);
})();

// ---- Bandeau social : navigation par fleches ----
// La photo courante vient se caler exactement dans la fenetre du cadre
// Instagram, pour que les deux ne fassent qu'un. Le HTML porte trois series
// (copie, serie reelle, copie) : quand l'index sort de la serie centrale, on se
// replie d'une serie sans transition, ce qui rend la boucle continue sans saut
// visible et garantit des photos des deux cotes du cadre.
(() => {
  const piste = document.querySelector(".insta-track");
  const scene = document.querySelector(".insta-stage");
  if (!piste || !scene) return;
  const vues = [...piste.querySelectorAll("li:not(.insta-clone) img")];
  const n = vues.length;
  if (!n) return;

  // La piste contient trois series : copie, serie reelle, copie. On demarre
  // sur la serie reelle (position n) pour que le cadre soit entoure de photos
  // des les deux cotes — sinon la gauche reste vide au chargement.
  let i = n;

  // Pas = largeur d'une vignette + espacement, lus au moment du calcul :
  // les deux dependent du viewport (clamp et gap en CSS).
  const pas = () => {
    const l = vues[0].getBoundingClientRect().width;
    const g = parseFloat(getComputedStyle(piste).gap) || 0;
    return l + g;
  };
  const placer = (anime) => {
    const l = vues[0].getBoundingClientRect().width;
    const x = scene.clientWidth / 2 - (i * pas() + l / 2);
    piste.style.transition = anime ? "transform .45s cubic-bezier(.4,0,.2,1)" : "none";
    if (anime) void piste.offsetWidth;   // force le recalcul, sinon la transition ne demarre pas
    piste.style.transform = `translateX(${x}px)`;
  };

  const aller = (d) => {
    // Repli AVANT de bouger, et non a la fin de l'animation precedente : rien ne
    // depend donc d'une minuterie ni d'un evenement de fin, qui se ratent ou se
    // font attendre (onglet en arriere-plan) et figeaient les fleches.
    // La vignette k et la vignette k+n portent la meme photo : se recaler d'une
    // serie, sans transition, ne se voit pas.
    if (i >= 2 * n) { i -= n; placer(false); }
    else if (i < n) { i += n; placer(false); }
    i += d;
    placer(true);
  };

  document.querySelector(".insta-prev")?.addEventListener("click", () => aller(-1));
  document.querySelector(".insta-next")?.addEventListener("click", () => aller(1));

  // Les images se chargent en differe : on replace des que les dimensions sont
  // connues, sinon le premier calage tombe a cote.
  const recaler = () => placer(false);
  vues.forEach((v) => v.complete || v.addEventListener("load", recaler, { once: true }));
  addEventListener("resize", recaler);
  requestAnimationFrame(recaler);
})();

// ---- Formulaire « Nous ecrire » ----
// Il ne partait qu'a Netlify, dont les envois n'atterrissent que dans le tableau
// de bord de l'hebergeur — personne dans l'equipe ne les y lisait. Il ecrit
// desormais dans contact_messages, d'ou un declencheur les recopie dans la boite
// de la console (voir db/59_contact_vers_messagerie.sql).
// L'envoi a Netlify est conserve, mais au mieux : c'est l'ecriture en base qui
// decide si le visiteur voit un succes.
document.addEventListener("submit", async (e) => {
  const f = e.target;
  if (f.id !== "lo-form") return;
  e.preventDefault();
  const btn = $("lo-send"), msg = $("lo-msg");
  const lu = (n) => (f.querySelector(`[name="${n}"]`)?.value || "").trim();
  const nom = lu("nom"), email = lu("email"), texte = lu("message");
  if (!nom || !email || !texte) return;
  btn.disabled = true; msg.className = "lo-msg"; msg.textContent = "Envoi…";

  const { error } = await sb.from("contact_messages").insert({
    source: "Nous écrire",
    name: nom.slice(0, 200),
    email: email.slice(0, 200),
    message: texte.slice(0, 4000),          // la base refuse au-dela
  });

  if (error) {
    msg.className = "lo-msg ko";
    msg.textContent = "L’envoi a échoué. Écrivez-nous directement à info@teamlausanne.ch.";
    btn.disabled = false;
    return;
  }
  // Trace chez Netlify, sans consequence si elle echoue.
  fetch("/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(new FormData(f)).toString(),
  }).catch(() => {});

  f.reset();
  msg.className = "lo-msg ok";
  msg.textContent = "Merci, votre message est parti. Nous vous répondrons tout bientôt.";
  btn.disabled = false;
});

// ---- Video : l'affiche laisse place au lecteur au clic ----
// Tant que personne n'a clique, le cadre est entierement a nous : ni habillage
// YouTube, ni requete vers YouTube. Les parametres reduisent ensuite ce que le
// lecteur affiche, sans pouvoir tout retirer — YouTube impose sa marque.
const FILM_PARAMS = "autoplay=1&rel=0&start=0&modestbranding=1&iv_load_policy=3&playsinline=1";
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-film]");
  if (!b) return;
  const f = document.createElement("iframe");
  f.className = "film-media";
  f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.dataset.film)}?${FILM_PARAMS}`;
  f.title = b.dataset.titre || "Vidéo";
  f.allow = "autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
  f.allowFullscreen = true;
  f.setAttribute("frameborder", "0");
  b.replaceWith(f);
});

// ---- Video : toujours reprise depuis le debut ----
// Au retour arriere, le navigateur peut restaurer la page telle quelle (bfcache),
// video comprise, la ou elle en etait. On recharge alors le cadre.
addEventListener("pageshow", (e) => {
  if (!e.persisted) return;
  document.querySelectorAll("iframe.film-media").forEach((f) => {
    // Changer l'adresse recharge le cadre. On retire l'autoplay au passage :
    // une video qui repart toute seule sur un retour arriere serait intrusive.
    f.src = f.src.replace(/([?&])autoplay=1/, "$1autoplay=0");
  });
  document.querySelectorAll("video.film-media").forEach((v) => { v.pause(); v.currentTime = 0; });
});

// ---- Portraits d'eleves : bascule au clic ----
// Le survol suffit a la souris, mais pas au doigt ni au clavier : le clic
// bascule donc l'etat, et aria-expanded le dit aux lecteurs d'ecran.
// Une seule carte ouverte a la fois, et un clic ailleurs les referme toutes :
// l'etat pose au clic survivait au depart de la souris, si bien qu'en parcourant
// les autres portraits on laissait derriere soi des cartes retournees qui
// avaient l'air bloquees.
function eleveFermer(sauf) {
  document.querySelectorAll(".eleve.ouvert").forEach((c) => {
    if (c === sauf) return;
    c.classList.remove("ouvert");
    const b = c.querySelector("[data-eleve]");
    if (b) b.setAttribute("aria-expanded", "false");
  });
}

document.addEventListener("click", (e) => {
  const bouton = e.target.closest("[data-eleve]");
  // L'etat vit sur la carte : c'est elle que le CSS interroge, et le lien
  // myTennis est son frere, hors du bouton.
  const carte = bouton ? bouton.closest(".eleve") : null;
  eleveFermer(carte);
  if (!bouton) return;
  const ouvert = carte.classList.toggle("ouvert");
  bouton.setAttribute("aria-expanded", ouvert ? "true" : "false");
});

// Echap referme la carte ouverte, comme partout ailleurs sur le site.
document.addEventListener("keydown", (e) => { if (e.key === "Escape") eleveFermer(null); });

// ---- Carrousel des portraits ----
// Une seule ligne qui defile, plutot qu'une grille qui s'empile : avec cinq
// athletes et d'autres a venir, la grille poussait le reste de la page
// toujours plus bas. Le defilement est celui du navigateur (overflow-x +
// scroll-snap) : le doigt et le trackpad marchent tout seuls, le clavier aussi
// puisque la piste est focalisable. Les fleches ne font qu'appeler scrollBy.
//
// Pas de glisser-deposer a la souris : il faudrait distinguer un glissement
// d'un clic, et un faux positif retournerait une carte sans qu'on l'ait
// demande. Les fleches, la molette et le doigt suffisent.
function carrMaj(shell) {
  const piste = shell.querySelector("[data-piste]");
  if (!piste) return;
  // Marge d'un pixel : les navigateurs arrondissent scrollLeft, et sans elle
  // la fleche de droite reste active alors qu'on est deja au bout.
  const reste = piste.scrollWidth - piste.clientWidth;
  const rien = reste <= 4;
  // Tolerance large : au repos scrollLeft vaut 2 et non 0, a cause du retrait
  // interieur de la piste et du calage (scroll-snap). Avec un seuil a 1, la
  // fleche de gauche restait active alors qu'on etait deja au debut.
  const prec = shell.querySelector(".carr-prec"), suiv = shell.querySelector(".carr-suiv");
  if (prec) { prec.hidden = rien; prec.disabled = piste.scrollLeft <= 4; }
  if (suiv) { suiv.hidden = rien; suiv.disabled = piste.scrollLeft >= reste - 4; }
}

// Defilement anime « a la main ».
//
// Pourquoi pas scrollBy({behavior:"smooth"}) : mesure faite, il ne produit
// RIEN sur cette piste. La piste a d'abord porte un calage (scroll-snap) ; le
// calage annulait le defilement programme, puis, une fois contourne, rendait
// les dernieres cartes inatteignables (les points de calage tombaient tous les
// 320 px pour une course maximale de 420). Le calage a donc ete retire : sur
// un carrousel de cartes, le defilement libre est la norme et supprime d'un
// coup toute cette classe d'ennuis. Reste une animation maison, qui marche.
function carrGlisser(piste, delta, duree = 380) {
  const max = piste.scrollWidth - piste.clientWidth;
  const depart = piste.scrollLeft;
  const cible = Math.max(0, Math.min(max, depart + delta));
  if (Math.abs(cible - depart) < 1) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { piste.scrollLeft = cible; return; }
  // Drapeau le temps du trajet : les evenements « scroll » que NOUS provoquons
  // ne doivent pas etre pris pour un geste de l'utilisateur, sans quoi le
  // defilement automatique se ferait taire a chaque pas.
  piste.dataset.anime = "1";
  const t0 = performance.now();
  const pas = (t) => {
    const k = Math.min(1, (t - t0) / duree);
    // Adoucissement aux deux bouts, pour que le depart et l'arret ne soient
    // pas secs.
    piste.scrollLeft = depart + (cible - depart) * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    if (k < 1) requestAnimationFrame(pas);
    // Un cran de retard avant de baisser le drapeau : l'evenement « scroll »
    // de la derniere image arrive apres elle.
    else setTimeout(() => { delete piste.dataset.anime; }, 120);
  };
  requestAnimationFrame(pas);
}
// Un pas = une carte, en reprenant sa largeur reelle (elle depend de la
// fenetre) plutot qu'une valeur ecrite en dur.
function carrPas(piste) {
  // La premiere carte, quelle que soit sa classe : la meme piste sert les
  // portraits d'eleves et les coachs.
  const carte = piste.firstElementChild;
  return carte ? carte.getBoundingClientRect().width + 18 : piste.clientWidth * 0.8;
}

// Defilement automatique. Le principe : il ne doit JAMAIS bouger sous le nez
// de quelqu'un qui regarde. D'ou quatre arrets francs — survol, carte ouverte,
// hors de l'ecran, onglet en arriere-plan — et une mise en sourdine de neuf
// secondes des qu'on touche a quoi que ce soit (fleche, doigt, molette,
// clavier) : on reprend la main, le carrousel se tait.
// Minuteurs et observateurs en cours, pour pouvoir les arreter. Chaque
// changement de page remplace tout le contenu de #world-main : sans ce
// menage, un minuteur restait a tourner sur une piste detachee du document, et
// il s'en ajoutait un a chaque navigation.
//
// En `var` a dessein : le module amorce la page (route(), plus haut) AVANT
// d'atteindre cette ligne. Un `let` serait alors encore dans sa zone morte et
// le premier rendu echouait sur un ReferenceError.
var carrMinuteurs, carrObservateurs;
function carrArreter() {
  (carrMinuteurs || []).forEach(clearInterval);
  (carrObservateurs || []).forEach((o) => o.disconnect());
  carrMinuteurs = []; carrObservateurs = [];
}

function carrAutomatique(shell, piste) {
  // Qui a demande moins d'animations n'aura pas de defilement du tout : ce
  // n'est pas un reglage de confort, c'est un besoin.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const CARR_DELAI = 4200;   // temps de lecture entre deux glissements
  const CARR_REPRISE = 9000; // silence apres une action de l'utilisateur

  let survol = false, aLEcran = false, silenceJusqua = 0;
  const enPause = () => survol || document.hidden || !aLEcran
    || Date.now() < silenceJusqua
    || !!piste.querySelector(".ouvert")              // on lit une fiche
    || shell.contains(document.activeElement);       // on navigue au clavier
  const taire = () => { silenceJusqua = Date.now() + CARR_REPRISE; };

  const avancer = () => {
    if (enPause()) return;
    const max = piste.scrollWidth - piste.clientWidth;
    if (max <= 4) return;                            // tout tient a l'ecran
    // Arrive au bout, on revient au debut. Le retour est un peu plus long que
    // le pas normal : sur toute la largeur, la meme duree paraitrait brutale.
    if (piste.scrollLeft >= max - 4) carrGlisser(piste, -max, 700);
    else carrGlisser(piste, carrPas(piste));
  };
  carrMinuteurs.push(setInterval(avancer, CARR_DELAI));

  shell.addEventListener("pointerenter", () => { survol = true; });
  shell.addEventListener("pointerleave", () => { survol = false; });
  // Le doigt ne survole pas : un appui vaut prise en main.
  shell.addEventListener("pointerdown", taire);
  shell.addEventListener("focusin", taire);
  // Un defilement a la molette ou au doigt : meme chose. On ne peut pas
  // distinguer ici notre propre animation d'un geste, d'ou le drapeau.
  piste.addEventListener("scroll", () => { if (!piste.dataset.anime) taire(); }, { passive: true });

  const oeil = new IntersectionObserver((e) => { aLEcran = e[0].isIntersecting; }, { threshold: 0.35 });
  oeil.observe(shell);
  carrObservateurs.push(oeil);
}

function carrInit() {
  carrArreter();
  document.querySelectorAll("[data-carrousel]").forEach((shell) => {
    if (shell.dataset.pret) return;
    shell.dataset.pret = "1";
    const piste = shell.querySelector("[data-piste]");
    if (!piste) return;
    piste.addEventListener("scroll", () => carrMaj(shell), { passive: true });
    shell.querySelectorAll("[data-carr]").forEach((b) => b.addEventListener("click", () => {
      carrGlisser(piste, Number(b.dataset.carr) * carrPas(piste));
    }));
    carrMaj(shell);
    // data-auto="0" : carrousel qui ne part jamais tout seul. Le carrousel des
    // coachs est juste au-dessus de la bande sombre des programmes, qui defile
    // deja : deux mouvements l'un sur l'autre fatiguent la lecture.
    if (shell.dataset.auto !== "0") carrAutomatique(shell, piste);
  });
}
window.addEventListener("resize", () => document.querySelectorAll("[data-carrousel]").forEach(carrMaj));

// ---- Brochure contre une adresse e-mail ----
// La demande est enregistree dans contact_messages : elle arrive ainsi dans la
// boite de la console (cf. db/59), ce qui permet de rappeler la personne.
// L'envoi de la brochure est confie a une fonction publique dediee ; s'il
// echoue, on donne quand meme le lien pour ne pas laisser le visiteur sans rien.
document.addEventListener("submit", async (e) => {
  const f = e.target;
  if (f.id !== "broch-form") return;
  e.preventDefault();
  const btn = $("broch-btn"), msg = $("broch-msg");
  const email = $("broch-email").value.trim();
  if (!email) return;
  const doc = f.dataset.doc;
  const sujet = f.dataset.sujet || "Sport-études";
  // Sans document, rien ne part automatiquement : la demande arrive au
  // secretariat, qui repond en personne. C'est le cas des filieres Pro, ou le
  // tarif se discute plutot qu'il ne s'affiche.
  const auto = !!doc;
  btn.disabled = true; msg.className = "broch-msg"; msg.textContent = "Envoi…";

  const { error } = await sb.from("contact_messages").insert({
    source: `Brochure ${sujet}`,
    name: email.split("@")[0].slice(0, 200),
    email: email.slice(0, 200),
    message: auto
      ? `Demande de la brochure ${sujet} depuis le site.`
      : `Demande d'informations ${sujet} depuis le site. Aucune brochure n'est envoyée automatiquement : à recontacter pour transmettre le dossier et discuter des conditions.`,
  });
  if (error) {
    msg.className = "broch-msg ko";
    msg.textContent = "L’envoi a échoué. Écrivez-nous à info@teamlausanne.ch.";
    btn.disabled = false;
    return;
  }

  let parti = false;
  if (auto) try {
    // Requete « simple », sans en-tete personnalise : la passerelle Supabase
    // repond au pre-vol sans renvoyer access-control-allow-headers, donc tout
    // en-tete ajoute ici ferait echouer l'appel. La fonction lit le corps en
    // JSON quel que soit le content-type, et n'exige pas de cle.
    const r = await fetch(`${SUPABASE_URL}/functions/v1/brochure-send`, {
      method: "POST",
      body: JSON.stringify({ email, doc }),
    });
    parti = r.ok;
  } catch (_) { /* le repli ci-dessous prend le relais */ }

  f.reset();
  msg.className = "broch-msg ok";
  msg.innerHTML = !auto
    ? "Merci ! Nous vous envoyons le dossier et reprenons contact avec vous rapidement pour en parler de vive voix."
    : parti
    ? "Merci, la brochure part dans votre boîte mail. Nous vous recontactons bientôt."
    : `Merci ! Voici la brochure : <a href="${esc(doc)}" target="_blank" rel="noopener">la télécharger</a>. Nous vous recontactons bientôt.`;
  btn.disabled = false;
});

// ---- Stages : filtrer les formules par tranche d'age ----
document.addEventListener("click", (e) => {
  const b = e.target.closest(".fm-filtre");
  if (!b) return;
  const sec = b.closest(".formules");
  const g = b.dataset.groupe;
  sec.querySelectorAll(".fm-filtre").forEach((x) => {
    const actif = x === b;
    x.classList.toggle("on", actif);
    x.setAttribute("aria-pressed", actif ? "true" : "false");
  });
  for (const carte of sec.querySelectorAll(".formula")) {
    carte.hidden = g !== "tous" && carte.dataset.groupe !== g;
  }
});
