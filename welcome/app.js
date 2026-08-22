// =====================================================================
//  LAUSANNE OPEN — console SPECTATEURS
//  Volontairement simple : quatre onglets, aucun compte, aucun backend.
//  Le contenu vit dans content.js. Seul l'order of play du jour est lu
//  en direct dans la base — celui que l'organisation dépose depuis le
//  backend des joueurs, pour ne pas avoir à le publier deux fois.
// =====================================================================
import { sb } from "./sb.js";
import { svg, ico } from "./icons.js";
import { LIENS, TOURNOI, SEEDS, PALMARES, PALMARES_NOTE, CLUB, ACADEMY, PARTENAIRES } from "./content.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const JOURS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
const MOIS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
const frJour = (s) => { const d = new Date(String(s).slice(0, 10) + "T00:00:00");
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`; };
const todayISO = () => { const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/* Drapeaux dessinés, pas d'emoji : Windows n'affiche pas les drapeaux emoji. */
const DRAPEAUX = {
  ch: `<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#D52B1E"/>
       <rect x="25" y="9" width="10" height="22" fill="#fff"/><rect x="14" y="15" width="32" height="10" fill="#fff"/></svg>`,
  it: `<svg viewBox="0 0 60 40"><rect width="20" height="40" fill="#008C45"/>
       <rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#CD212A"/></svg>`,
  gr: `<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#0D5EAF"/>
       ${[1,3,5,7].map((i) => `<rect y="${i*40/9}" width="60" height="${40/9}" fill="#fff"/>`).join("")}
       <rect width="22.2" height="22.2" fill="#0D5EAF"/>
       <rect x="8.9" width="4.4" height="22.2" fill="#fff"/><rect y="8.9" width="22.2" height="4.4" fill="#fff"/></svg>`,
  neutre: `<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#2a3763"/>
       <path d="M8 20h44" stroke="#98a3c8" stroke-width="3" stroke-linecap="round"/></svg>`,
};
const drapeau = (id) => `<span class="flag">${DRAPEAUX[id] || DRAPEAUX.neutre}</span>`;

/* ---------------------------------------------------------- onglets */
const TABS = [
  { id: "tournoi",     label: "Le tournoi",   icon: "trophy" },
  { id: "seeds",       label: "Têtes de série", icon: "users" },
  { id: "club",        label: "Le club",     icon: "racket" },
  { id: "academy",     label: "L'académie",  icon: "trend" },
  { id: "partenaires", label: "Partenaires", icon: "medal" },
];
let cur = "tournoi";

function renderTabs() {
  const nav = $("tabs");
  nav.style.gridTemplateColumns = `repeat(${TABS.length},1fr)`;
  nav.innerHTML = TABS.map((t) =>
    `<button class="lo-tab${t.id === cur ? " on" : ""}" data-tab="${t.id}">
       ${svg(t.icon)}<span>${esc(t.label)}</span></button>`).join("");
  nav.onclick = (e) => {
    const b = e.target.closest("[data-tab]");
    if (b) location.hash = "#" + b.dataset.tab;
  };
}

function route() {
  const want = (location.hash || "").replace("#", "") || "tournoi";
  cur = TABS.some((t) => t.id === want) ? want : "tournoi";
  document.querySelectorAll(".lo-tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === cur));
  window.scrollTo(0, 0);
  ({ tournoi: vTournoi, seeds: vSeeds, club: vClub, academy: vAcademy, partenaires: vPartenaires }[cur])($("view"));
}

/* -------------------------------------------------- brique réutilisée */
const carte = (icon, titre, corps) => `
  <article class="card"><div class="card-in">
    <h3>${ico(icon)} ${esc(titre)}</h3>${corps}
  </div></article>`;

/* ========================================================= LE TOURNOI */
async function vTournoi(v) {
  v.innerHTML = `
    <div class="hero with-photo"
         style="background-image:linear-gradient(180deg,rgba(7,13,36,.15),rgba(7,13,36,.9)),url('assets/hero.webp')">
      <h2>${esc(TOURNOI.titre)}</h2>
      <p>${esc(TOURNOI.chapo)}</p>
      <div class="badges">${TOURNOI.badges.map((b, i) =>
        `<span class="badge${i === 0 ? " fluo" : ""}">${esc(b)}</span>`).join("")}</div>
    </div>

    <div class="maps-row" style="margin:0 0 16px">
      <a class="maps-btn" href="${LIENS.oop}" target="_blank" rel="noopener">${svg("clipboard")}Order of play</a>
      <a class="maps-btn" href="${LIENS.tableau}" target="_blank" rel="noopener">${svg("trophy")}Le tableau</a>
      <a class="maps-btn" href="${LIENS.live}" target="_blank" rel="noopener">${svg("ball")}Scores en direct</a>
    </div>
    <div id="oop-jour"></div>

    ${carte("calendar", "Infos pratiques", `<div class="kv">${TOURNOI.infos.map(([k, x]) =>
      `<div><span>${esc(k)}</span><b>${x}</b></div>`).join("")}</div>
      <p class="lnk"><a href="${LIENS.maps}" target="_blank" rel="noopener">Itinéraire ↗</a></p>`)}

    ${carte("bulb", "Bien profiter du tournoi",
      `<ul>${TOURNOI.aSavoir.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`)}

    ${carte("users", "Voici les 6 têtes de série",
      `<p>Deux anciens numéros 1 mondiaux juniors, dont le tenant du titre, et quatre autres
          joueurs classés parmi les 600 meilleurs du monde.</p>
       <a class="btn block" style="margin-top:12px" href="#seeds">${svg("users")}Découvrir les six joueurs</a>`)}

    <div class="sec-title">${svg("trophy", "mk")} Palmarès</div>
    <p class="lo-lead">${esc(PALMARES_NOTE)}</p>
    ${PALMARES.map((p) => carte("medal", p.annee,
      `<div class="kv">
         <div><span>Simple</span><b>${p.simple}</b></div>
         <div><span>Double</span><b>${p.double}</b></div>
       </div>`)).join("")}

    ${carte("chat", "Suivre le club au quotidien",
      `<p>Photos, résultats et coulisses toute l'année sur le compte Instagram du Lausanne-Sports Tennis.</p>
       <a class="btn block" style="margin-top:12px" href="${LIENS.instagram}" target="_blank" rel="noopener">
         @lausanne_sports_tennis</a>`)}`;

  chargerOopDuJour();
}

function seedHTML(s) {
  const src = s.photo.includes(".") ? s.photo : s.photo + ".jpg";
  const sommet = s.atp === s.best;
  return `<article class="seed">
    <div class="seed-photo">
      <img src="assets/players/${src}" alt="${esc(s.nom)}" loading="lazy" />
      <span class="seed-n">${s.n}</span>
      <div class="seed-over">
        <h4>${drapeau(s.drapeau)}${esc(s.nom)}</h4>
        <p class="seed-atp">ATP ${s.atp} · ${sommet ? "au meilleur de sa carrière" : `meilleur : ${s.best}ᵉ`}</p>
      </div>
    </div>
    <div class="seed-in"><p>${esc(s.bio)}</p></div>
  </article>`;
}

// L'order of play déposé par l'organisation pour aujourd'hui, s'il existe.
async function chargerOopDuJour() {
  const box = $("oop-jour");
  if (!box) return;
  const { data } = await sb.from("lo_oop").select("day,mime,updated_at").eq("day", todayISO()).maybeSingle();
  if (!data) return;
  const { data: full } = await sb.from("lo_oop").select("data,mime").eq("day", data.day).single();
  if (!full) return;
  const bin = atob(full.data);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([buf], { type: full.mime || "application/pdf" }));
  box.innerHTML = carte("clipboard", `Programme du jour — ${frJour(data.day)}`,
    `<p>Le programme affiché au bureau du tournoi, tel qu'il a été publié aujourd'hui.</p>
     <a class="btn block" style="margin-top:12px" href="${url}" target="_blank" rel="noopener">
       ${svg("file")}Ouvrir le programme</a>`);
}

/* ====================================================== TETES DE SERIE */
function vSeeds(v) {
  v.innerHTML = `
    <div class="hero">
      <h2>Voici les 6 têtes de série</h2>
      <p>Deux anciens numéros 1 mondiaux juniors, dont le tenant du titre, le plus expérimenté
         du lot et trois autres joueurs classés parmi les 600 meilleurs du monde. Voici qui
         vient jouer aux Plaines-du-Loup cette semaine.</p>
      <div class="badges"><span class="badge fluo">Classement ATP au tirage</span></div>
    </div>
    <div class="seeds">${SEEDS.map(seedHTML).join("")}</div>
    ${carte("clipboard", "Suivre le tableau",
      `<p>Le tirage complet, les résultats tour par tour et les scores en direct sont publiés
          par l’ITF pendant toute la semaine.</p>
       <div class="maps-row" style="margin-top:12px">
         <a class="maps-btn" href="${LIENS.tableau}" target="_blank" rel="noopener">${svg("trophy")}Le tableau</a>
         <a class="maps-btn" href="${LIENS.live}" target="_blank" rel="noopener">${svg("ball")}Scores en direct</a>
       </div>`)}`;
}

/* ============================================================= LE CLUB */
function vClub(v) {
  v.innerHTML = `
    <div class="hero with-photo"
         style="background-image:linear-gradient(180deg,rgba(7,13,36,.2),rgba(7,13,36,.92)),url('assets/club.jpg')">
      <h2>${esc(CLUB.titre)}</h2>
      <p>${esc(CLUB.chapo)}</p>
    </div>
    <div class="sec-title">${svg("medal", "mk")} Pourquoi devenir membre</div>
    ${CLUB.avantages.map((a) => carte(a.icon, a.titre, `<p>${esc(a.texte)}</p>`)).join("")}
    ${carte("phone", "Nous rejoindre",
      `<p>${esc(CLUB.contact)}</p>
       <div class="kv" style="margin-top:10px">
         <div><span>Adresse</span><b>Route des Plaines-du-Loup 7<br>1018 Lausanne</b></div>
         <div><span>Téléphone</span><b><a href="tel:${LIENS.tel}">${LIENS.telAffiche}</a></b></div>
       </div>
       <a class="btn block" style="margin-top:14px" href="tel:${LIENS.tel}">${svg("phone")}Appeler le club</a>`)}`;
}

/* ========================================================== L'ACADÉMIE */
function vAcademy(v) {
  v.innerHTML = `
    <div class="hero with-photo"
         style="background-image:linear-gradient(180deg,rgba(7,13,36,.2),rgba(7,13,36,.92)),url('assets/academy.png')">
      <h2>${esc(ACADEMY.titre)}</h2>
      <p>${esc(ACADEMY.chapo)}</p>
    </div>
    ${ACADEMY.offres.map((o) => carte(o.icon, o.titre, `<p>${esc(o.texte)}</p>`)).join("")}
    ${carte("phone", "Inscrire un enfant",
      `<p>Stages, cours juniors, essai : le plus simple est de nous appeler, ou de passer au club-house pendant le tournoi.</p>
       <a class="btn block" style="margin-top:12px" href="tel:${LIENS.tel}">${svg("phone")}${LIENS.telAffiche}</a>`)}`;
}

/* ========================================================= PARTENAIRES */
function vPartenaires(v) {
  v.innerHTML = `
    <h2 class="lo-h2">Merci à nos partenaires</h2>
    <p class="lo-lead">Le Lausanne Open n'existerait pas sans eux. Institutions, entreprises et
       commerces de la région : leur soutien permet d'accueillir chaque année le circuit
       professionnel à Lausanne, et d'en garder l'entrée libre pour tout le monde.</p>
    <div class="sponsors">${PARTENAIRES.map((p) => `
      <a class="sponsor" href="${p.url}" target="_blank" rel="noopener" title="${esc(p.nom)}">
        <img src="assets/sponsors/${p.logo}.png" alt="${esc(p.nom)}" loading="lazy" />
        <span>${esc(p.nom)}</span>
      </a>`).join("")}</div>
    ${carte("trend", "Devenir partenaire",
      `<p>Associer votre entreprise au seul tournoi international masculin du canton, c'est possible —
          de la formule visibilité au partenariat sur mesure.</p>
       <a class="btn block" style="margin-top:12px" href="${LIENS.site}/partenariats" target="_blank" rel="noopener">
         Découvrir les formules</a>`)}`;
}

/* ------------------------------------------------------------ départ */
renderTabs();
window.addEventListener("hashchange", route);
route();
