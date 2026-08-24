// =====================================================================
//  LAUSANNE OPEN — Player Hub (app joueurs)
//  Pas de login : lecture publique, écritures via des fonctions RPC
//  contrôlées côté base (voir db/06_lausanne_open.sql).
//  Interface en 5 langues (i18n.js) ; contenu des pages Welcome dans
//  content.js. Ce qui vient du backend garde la langue de saisie.
// =====================================================================
import { sb } from "./sb.js";
import { svg, ico, big } from "./icons.js";
import { LANGS, FLAGS, t, tr, setLang, getLang, detectLang } from "./i18n.js";
import { WELCOME, VISIT_MAPS } from "./content.js";
import { hit } from "./hit.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ------------------------------------------------------------- dates */
const DAYS = { en: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], fr: ["dim","lun","mar","mer","jeu","ven","sam"],
               de: ["So","Mo","Di","Mi","Do","Fr","Sa"], it: ["dom","lun","mar","mer","gio","ven","sab"],
               es: ["dom","lun","mar","mié","jue","vie","sáb"] };
const MONTHS = { en: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
                 fr: ["janv","févr","mars","avr","mai","juin","juil","août","sept","oct","nov","déc"],
                 de: ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"],
                 it: ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"],
                 es: ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"] };
const L = () => getLang();
const toDate = (s) => new Date(String(s).slice(0, 10) + "T00:00:00");
const dayLabel = (s) => { const d = toDate(s); return `${DAYS[L()][d.getDay()]} ${d.getDate()} ${MONTHS[L()][d.getMonth()]}`; };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const hhmm = (x) => String(x || "").slice(0, 5);
function ago(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return t("c.justNow");
  if (s < 3600) return t("c.minAgo", { n: Math.floor(s / 60) });
  if (s < 86400) return t("c.hAgo", { n: Math.floor(s / 3600) });
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[L()][d.getMonth()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* --------------------------------------------- mémoire du navigateur */
// Le joueur n'a pas de compte : on garde localement le jeton qui lui permet
// d'annuler SA réservation / SON message.
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem("lo_" + k) || "{}"); } catch { return {}; } },
  set(k, v) { try { localStorage.setItem("lo_" + k, JSON.stringify(v)); } catch { /* mode privé */ } },
  add(k, id, tok) { const o = this.get(k); o[id] = tok; this.set(k, o); },
  del(k, id) { const o = this.get(k); delete o[id]; this.set(k, o); },
  name: {
    get() { return localStorage.getItem("lo_name") || ""; },
    set(v) { try { localStorage.setItem("lo_name", v); } catch { /* ignore */ } },
  },
};

/* --------------------------------------------------------- onglets */
const TABS = [
  { id: "welcome",   icon: "city" },
  { id: "info",      icon: "megaphone" },
  { id: "logistics", icon: "suitcase" },
  { id: "oop",       icon: "clipboard" },
  { id: "practice",  icon: "racket" },
  { id: "sparring",  icon: "users" },
  { id: "roommate",  icon: "bed" },
  { id: "paella",    icon: "utensils" },
];
const SUBS = ["city", "swiss", "club", "academy", "open", "visit"];

const state = { tabs: {}, settings: {}, cur: "welcome", sub: {}, timer: null };
const setting = (k, f, d = "") => (state.settings[k] && state.settings[k][f]) || d;

/* ===================================================================
   Démarrage
   =================================================================== */
async function boot() {
  setLang(detectLang());
  document.documentElement.lang = getLang();
  const { data } = await sb.from("lo_settings").select("key,value");
  state.settings = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  state.tabs = state.settings.tabs || {};
  renderLang();
  renderTabs();
  window.addEventListener("hashchange", route);
  route();
}

const visible = (id) => state.tabs[id] !== false;

/* ---------------------------------------------------- choix de langue */
function renderLang() {
  const cur = LANGS.find((l) => l.id === getLang()) || LANGS[0];
  $("lang").innerHTML = `
    <button class="lang-btn" id="lang-btn" aria-label="Language">
      <span class="flag">${FLAGS[cur.flag]}</span>
      <span class="lang-code">${cur.id.toUpperCase()}</span>
    </button>
    <div class="lang-menu hidden" id="lang-menu">
      ${LANGS.map((l) => `<button data-lang="${l.id}" class="${l.id === cur.id ? "on" : ""}">
        <span class="flag">${FLAGS[l.flag]}</span>${l.label}</button>`).join("")}
    </div>`;
  $("lang-btn").onclick = (e) => { e.stopPropagation(); $("lang-menu").classList.toggle("hidden"); };
  $("lang-menu").onclick = (e) => {
    const b = e.target.closest("[data-lang]");
    if (!b) return;
    setLang(b.dataset.lang);
    try { localStorage.setItem("lo_lang", b.dataset.lang); } catch { /* ignore */ }
    document.documentElement.lang = getLang();
    renderLang(); renderTabs(); render();
  };
}
// un clic n'importe où ailleurs referme le menu des langues
document.addEventListener("click", () => {
  const m = $("lang-menu"); if (m) m.classList.add("hidden");
});

function renderTabs() {
  const list = TABS.filter((x) => visible(x.id));
  const nav = $("tabs");
  // grille : les onglets tiennent tous à l'écran, sans défilement horizontal
  nav.style.gridTemplateColumns = `repeat(${list.length},1fr)`;
  nav.innerHTML = list.map((x) =>
    `<button class="lo-tab${x.id === state.cur ? " on" : ""}" data-tab="${x.id}">
       ${svg(x.icon)}<span>${esc(t("tab." + x.id))}</span></button>`).join("");
  nav.onclick = (e) => {
    const b = e.target.closest("[data-tab]");
    if (b) location.hash = "#" + b.dataset.tab;
  };
}

function route() {
  const want = (location.hash || "").replace("#", "") || "welcome";
  const list = TABS.filter((x) => visible(x.id)).map((x) => x.id);
  state.cur = list.includes(want) ? want : (list[0] || "welcome");
  document.querySelectorAll(".lo-tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === state.cur));
  if (state.timer) { clearInterval(state.timer); state.timer = null; }
  window.scrollTo(0, 0);
  hit("players", state.cur, getLang());
  render();
}

function render() {
  const v = $("view");
  v.onclick = null;
  v.innerHTML = `<span class="spin"></span>`;
  ({ welcome: viewWelcome, info: viewInfo, logistics: viewLogistics, oop: viewOop,
     practice: viewPractice, sparring: viewBoard, roommate: viewBoard,
     paella: viewPaella }[state.cur] || viewWelcome)(v);
}

/* barre de sous-onglets réutilisable */
function subBar(key, items, onPick, grid, defaut) {
  // Tant que le visiteur n a rien choisi, on ouvre sur "defaut" (le jour
  // courant) plutot que sur le premier de la liste.
  const cur = items.some((i) => i.id === state.sub[key]) ? state.sub[key]
            : (items.some((i) => i.id === defaut) ? defaut : items[0].id);
  state.sub[key] = cur;
  // grid = tous les sous-onglets tiennent a l ecran (Welcome, Sejour).
  // Sans grid, ils defilent : c est le cas des listes de jours, ou il peut
  // y en avoir neuf.
  const html = `<div class="lo-sub${grid ? " grid" : ""}"${grid ? ` style="grid-template-columns:repeat(${items.length},1fr)"` : ""}>${items.map((i) =>
    `<button data-s="${i.id}" class="${i.id === cur ? "on" : ""}">${i.label}</button>`).join("")}</div>`;
  return { html, cur, bind(root) {
    root.querySelector(".lo-sub").onclick = (e) => {
      const b = e.target.closest("[data-s]");
      if (!b) return;
      state.sub[key] = b.dataset.s;
      onPick();
    };
  } };
}

/* ===================================================================
   Onglet WELCOME — le HTML est fabriqué ici, le texte vient de content.js
   =================================================================== */
const src = (name) => `assets/visit/${name.includes(".") ? name : name + ".jpg"}`;
const photoBox = (name, icon) =>
  `<div class="card-photo${name ? "" : " noimg"}">
     ${name ? `<img src="${src(name)}" alt="" loading="lazy" />` : ""}
     ${svg(icon, "ph")}
   </div>`;

// Un lieu = une chaine ; deux lieux = un tableau {label, q}. Le libelle par
// defaut suit la langue choisie, celui d un tableau est un nom propre.
function mapsButtons(spec) {
  const list = Array.isArray(spec) ? spec : [{ label: t("log.maps"), q: spec }];
  return `<div class="maps-row">` + list.map((m) =>
    `<a class="maps-btn" target="_blank" rel="noopener"
       href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.q)}">${svg("mappin")}${esc(m.label)}</a>`).join("") + `</div>`;
}

function cardHTML(c, withPhoto) {
  // La carte « numéros d'urgence » gagne le bureau du tournoi et des liens tel:
  let kv = c.kv;
  if (c.icon === "phone") {
    kv = [...c.kv, [t("c.office"), "+41 21 646 13 50"]]
      .map(([k, v]) => [k, /^[+\d][\d\s]*$/.test(v) ? `<a href="tel:${v.replace(/\s/g, "")}">${v}</a>` : v]);
  }
  return `<article class="card${withPhoto ? " with-photo" : ""}">
    ${withPhoto ? photoBox(c.photo, c.icon) : ""}
    <div class="card-in">
      <h3>${ico(c.icon)} ${esc(c.title)}</h3>
      ${c.text ? `<p>${c.text}</p>` : ""}
      ${c.list ? `<ul>${c.list.map((li) => `<li>${li}</li>`).join("")}</ul>` : ""}
      ${kv ? `<div class="kv">${kv.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("")}</div>` : ""}
      ${c.note ? `<p class="note">${c.note}</p>` : ""}
      ${c.link ? `<p class="lnk"><a href="${c.link.href}" target="_blank" rel="noopener">${c.link.label}</a></p>` : ""}
      ${withPhoto && VISIT_MAPS[c.icon] ? mapsButtons(VISIT_MAPS[c.icon]) : ""}
    </div>
  </article>`;
}

function viewWelcome(v) {
  const bar = subBar("welcome", SUBS.map((id) => ({ id, label: esc(t("sub." + id)) })), () => viewWelcome(v), true);
  const sec = (WELCOME[L()] || WELCOME.en)[bar.cur];
  const isVisit = bar.cur === "visit";

  const hero = sec.hero ? `
    <div class="hero${sec.photo ? " with-photo" : ""}"
         ${sec.photo ? `style="background-image:linear-gradient(180deg,rgba(7,13,36,.12),rgba(7,13,36,.88)),url('${src(sec.photo)}')"` : ""}>
      <h2>${esc(sec.hero.title)}</h2>
      <p>${esc(sec.hero.text)}</p>
      ${(sec.hero.badges || []).length ? `<div class="badges">${sec.hero.badges.map((b, i) =>
        `<span class="badge${i === 0 ? " fluo" : ""}">${esc(b)}</span>`).join("")}</div>` : ""}
    </div>` : "";

  v.innerHTML = bar.html + hero + sec.cards.map((c) => cardHTML(c, isVisit)).join("")
    + (isVisit || sec.photo ? `<p class="credits">${esc(t("c.photos"))}</p>` : "");
  bar.bind(v);
  // une photo absente bascule sur le dégradé + icône : jamais de case vide
  v.querySelectorAll(".card-photo img").forEach((img) => {
    img.onerror = () => img.closest(".card-photo").classList.add("noimg");
  });
}

/* =============================================== onglet OFFICIAL INFO */
async function viewInfo(v) {
  const draw = async () => {
    const { data } = await sb.from("lo_messages").select("*")
      .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(60);
    const list = data || [];
    v.innerHTML = `
      <h2 class="lo-h2">${esc(t("info.title"))}</h2>
      <p class="lo-lead">${esc(t("info.lead"))}</p>
      ${list.length ? list.map((m) => `
        <article class="msg ${esc(m.level)}">
          <div class="msg-top">
            ${m.pinned ? `<span class="pin">${esc(t("info.pinned"))}</span>` : ""}
            ${m.level !== "info" ? `<span class="msg-lvl">${esc(t(m.level === "urgent" ? "info.urgent" : "info.important"))}</span>` : ""}
            ${m.title ? `<b>${esc(m.title)}</b>` : ""}
            <span class="msg-time">${ago(m.created_at)}</span>
          </div>
          <p>${esc(m.body)}</p>
        </article>`).join("")
      : `<div class="empty">${big("megaphone")}${esc(t("info.empty"))}</div>`}`;
  };
  await draw();
  state.timer = setInterval(draw, 60000);   // rafraîchissement auto
}

/* ============================================ onglet HOTEL & FOOD */
async function viewLogistics(v) {
  const bar = subBar("log", [
    { id: "hotel",   label: `${svg("bed")}${esc(t("log.hotel"))}` },
    { id: "shuttle", label: `${svg("bus")}${esc(t("log.shuttle"))}` },
    { id: "resto",   label: `${svg("utensils")}${esc(t("log.resto"))}` },
  ], () => viewLogistics(v), true);

  let body = "";
  if (bar.cur === "hotel") {
    const maps = setting("hotel", "maps") ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(setting("hotel", "address"))}`;
    const tel = setting("hotel", "phone");
    body = `
      <article class="card"><div class="card-in">
        <h3>${ico("bed")} ${esc(setting("hotel", "name", "Hotel"))}</h3>
        <div class="kv">
          <div><span>${esc(t("log.address"))}</span><b>${esc(setting("hotel", "address")).replace(/, /g, "<br>")}</b></div>
          ${tel ? `<div><span>${esc(t("log.phone"))}</span><b><a href="tel:${esc(tel.replace(/\s/g, ""))}">${esc(tel)}</a></b></div>` : ""}
        </div>
        <p class="note">${esc(setting("hotel", "note") || t("def.hotelNote"))}</p>
        <a class="btn block" style="margin-top:14px" href="${esc(maps)}" target="_blank" rel="noopener">${esc(t("log.maps"))}</a>
      </div></article>`;
  } else if (bar.cur === "shuttle") {
    const { data } = await sb.from("lo_shuttle").select("*")
      .order("day", { ascending: true, nullsFirst: true }).order("sort").order("dep_time");
    const today = todayISO();
    const upcoming = (data || []).filter((r) => !r.day || r.day >= today);
    const groups = {};
    upcoming.forEach((r) => { (groups[r.day || "always"] ||= []).push(r); });
    const keys = Object.keys(groups).sort((a, b) => (a === "always" ? -1 : b === "always" ? 1 : a < b ? -1 : 1));
    // Le bus de ligne d abord : c est ce que les joueurs utilisent vraiment.
    body = `
      <article class="card"><div class="card-in">
        <h3>${ico("bus")} ${esc(t("bus.title"))}</h3>
        <ul class="bus-steps">
          <li>${t("bus.toHotel")}</li>
          <li>${t("bus.toClub")}</li>
          <li>${t("bus.back")}</li>
        </ul>
        <p class="note">${t("bus.card")}</p>
      </div></article>

      <article class="card"><div class="card-in">
        <h3>${ico("city")} ${esc(t("bus.walk"))}</h3>
        <iframe class="walk-map" loading="lazy" title="${esc(t("bus.walk"))}"
          src="https://maps.google.com/maps?saddr=Lausanne%2C%20St-Roch&amp;daddr=Rue%20du%20Maupas%2020%2C%201004%20Lausanne&amp;dirflg=w&amp;z=16&amp;output=embed"></iframe>
      </div></article>`
      // Les horaires de navette ne s affichent que s il y en a de saisis.
      + (upcoming.length ? keys.map((k) => `
      <article class="card"><div class="card-in">
        <h3>${ico("bus")} ${k === "always" ? esc(t("log.everyday")) : dayLabel(k)}</h3>
        <div class="kv">
          ${groups[k].map((r) => `<div>
            <span>${esc(hhmm(r.dep_time))}${r.note ? ` · ${esc(r.note)}` : ""}</span>
            <b>${esc(r.from_place || "—")} → ${esc(r.to_place || "—")}</b>
          </div>`).join("")}
        </div>
      </div></article>`).join("") : "");
  } else {
    const { data } = await sb.from("lo_menu").select("*").eq("active", true).order("sort").order("id");
    const items = data || [];
    body = `
      <article class="card"><div class="card-in">
        <h3>${ico("utensils")} ${esc(setting("restaurant", "name", "Restaurant"))}</h3>
        ${setting("restaurant", "address") ? `<p class="lo-lead" style="margin:0 0 12px">${esc(setting("restaurant", "address"))}</p>` : ""}
        <div class="kv">
          ${items.length ? items.map((m) => `<div>
            <span>${esc(tr("dish", m.name))}${m.description ? `<br><small style="opacity:.7">${esc(tr("dish", m.description))}</small>` : ""}</span>
            <b>${m.price != null ? `${Number(m.price).toFixed(2)} CHF` : ""}</b>
          </div>`).join("") : `<div><span>${esc(t("log.nomenu"))}</span><b></b></div>`}
        </div>
        <p class="note">${esc(setting("restaurant", "note") || t("def.restoNote"))}</p>
      </div></article>`;
  }
  v.innerHTML = `<h2 class="lo-h2">${esc(t("log.title"))}</h2>` + bar.html + body;
  bar.bind(v);
}

/* ============================================== onglet ORDER OF PLAY */
function b64ToBlob(b64, mime) {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime || "application/pdf" });
}

async function viewOop(v) {
  const { data } = await sb.from("lo_oop").select("day,filename,mime,updated_at").order("day", { ascending: false });
  const days = data || [];

  // Le programme change en cours de journee : on reverifie toutes les minutes
  // et on ne re-affiche que si un fichier a bouge, pour ne pas recharger le
  // PDF sous les yeux du joueur en train de le lire.
  const signature = days.map((d) => d.day + d.updated_at).join("|");
  if (state.timer) clearInterval(state.timer);
  state.timer = setInterval(async () => {
    if (state.cur !== "oop") return;
    const { data: maj } = await sb.from("lo_oop").select("day,updated_at").order("day", { ascending: false });
    if ((maj || []).map((d) => d.day + d.updated_at).join("|") !== signature) viewOop(v);
  }, 60000);
  if (!days.length) {
    v.innerHTML = `<h2 class="lo-h2">${esc(t("oop.title"))}</h2>
      <div class="empty">${big("clipboard")}${esc(t("oop.empty"))}</div>`;
    return;
  }
  // Un order of play parait la veille au soir : le jour ouvert par defaut
  // est celui du DERNIER programme publie, pas celui d aujourd hui.
  const dernier = days.slice().sort((a, b) =>
    String(b.updated_at).localeCompare(String(a.updated_at)))[0];
  // la barre, elle, reste dans l ordre chronologique
  const parJour = days.slice().sort((a, b) => a.day.localeCompare(b.day));
  const bar = subBar("oop", parJour.map((d) => ({ id: d.day, label: dayLabel(d.day) })),
                     () => viewOop(v), false, dernier ? dernier.day : todayISO());
  const pick = days.find((d) => d.day === bar.cur) || days[0];

  v.innerHTML = `<h2 class="lo-h2">${esc(t("oop.title"))}</h2>
    <p class="lo-lead">${esc(t("oop.updated"))} ${ago(pick.updated_at)}. ${esc(t("oop.lead"))}</p>
    ${bar.html}
    <div id="oop-box"><span class="spin"></span></div>`;
  bar.bind(v);

  const { data: full } = await sb.from("lo_oop").select("data,mime,filename").eq("day", pick.day).single();
  const box = $("oop-box");
  if (!full) { box.innerHTML = `<div class="empty">${esc(t("oop.failed"))}</div>`; return; }
  const url = URL.createObjectURL(b64ToBlob(full.data, full.mime));
  const isImg = (full.mime || "").startsWith("image/");
  const small = window.matchMedia("(max-width: 760px)").matches;

  box.innerHTML = isImg
    ? `<article class="card" style="padding:8px"><img src="${url}" alt="" style="width:100%;border-radius:10px;display:block" /></article>
       <a class="btn block ghost" href="${url}" target="_blank" rel="noopener">${esc(t("oop.full"))}</a>`
    : `<a class="btn block" href="${url}" target="_blank" rel="noopener">${svg("file")}${esc(t("oop.open"))}</a>
       ${small ? "" : `<article class="card" style="padding:8px;margin-top:12px">
          <iframe src="${url}" title="Order of play" style="width:100%;height:70vh;border:0;border-radius:10px;background:#fff"></iframe></article>`}`;
}

/* ================================================== onglet PRACTICE */
async function viewPractice(v) {
  const now = Date.now();
  const { data } = await sb.from("lo_practice_days").select("*").gte("day", todayISO()).order("day");
  const days = (data || []).filter((d) => !d.visible_from || new Date(d.visible_from).getTime() <= now);

  const intro = `<h2 class="lo-h2">${esc(t("prac.title"))}</h2>
    <p class="lo-lead">${esc(setting("practice_intro", "text") || t("def.practiceIntro"))}</p>
    <article class="card"><div class="card-in"><h3>${ico("ball")} ${esc(t("prac.balls"))}</h3>
      <p>${esc(setting("balls", "text") || t("def.balls"))}</p></div></article>`;

  if (!days.length) {
    v.innerHTML = intro + `<div class="empty">${big("racket")}${esc(t("prac.empty"))}</div>`;
    return;
  }

  const bar = subBar("prac", days.map((d) => ({ id: d.day, label: dayLabel(d.day) })),
                     () => viewPractice(v), false, todayISO());
  const d = days.find((x) => x.day === bar.cur) || days[0];

  const { data: bk } = await sb.from("lo_practice_bookings")
    .select("id,day,court,start_time,seat,player_name").eq("day", d.day);
  // deux places par creneau : la cle porte le numero de place
  const taken = {};
  (bk || []).forEach((b) => { taken[`${b.court}|${hhmm(b.start_time)}|${b.seat || 1}`] = b; });
  const mine = store.get("bookings");

  const slots = [];
  const [h0, m0] = d.first_time.split(":").map(Number);
  const [h1, m1] = d.last_time.split(":").map(Number);
  for (let x = h0 * 60 + m0; x <= h1 * 60 + m1; x += d.slot_min) {
    slots.push(`${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`);
  }
  const courts = d.court_names || [];
  // Un creneau commence ne se reserve plus et ne s annule plus, meme vide.
  const commence = (heure) => {
    const [hh, mm] = heure.split(":").map(Number);
    const t = new Date(d.day + "T00:00:00");
    t.setHours(hh, mm, 0, 0);
    return t.getTime() <= Date.now();
  };

  // Chaque court occupe DEUX colonnes : deux joueurs peuvent le reserver
  // sur le meme creneau, comme les deux cotes d un court de double.
  const cells = [`<div class="pcell hh"></div>`,
    ...courts.map((c, i) => `<div class="pcell hh hh2 c${i % 3}">${esc(c)}</div>`)];
  slots.forEach((s) => {
    cells.push(`<div class="pcell th${commence(s) ? " past" : ""}">${s}</div>`);
    courts.forEach((c, ci) => {
      const fige = commence(s);
      for (const k of [1, 2]) {
        const b = taken[`${c}|${s}|${k}`];
        if (!b) {
          cells.push(`<div class="pcell pslot c${ci % 3}${fige ? " past" : ""}"
            ${fige ? "" : `data-book="${esc(c)}|${s}"`}>${fige ? "" : "+"}</div>`);
        } else {
          const own = !!mine[b.id] && !fige;
          cells.push(`<div class="pcell pslot c${ci % 3} ${own ? "mine" : "taken"}${fige ? " past" : ""}"
            ${own ? `data-cancel="${b.id}"` : ""}>
            ${esc(b.player_name)}${own ? `<small>${esc(t("prac.tap"))}</small>` : ""}</div>`);
        }
      }
    });
  });

  v.innerHTML = intro + bar.html + `
    ${d.note ? `<article class="card"><div class="card-in"><p>${esc(d.note)}</p></div></article>` : ""}
    <div class="pg-wrap"><div class="pgrid"
      style="grid-template-columns:56px repeat(${courts.length * 2},minmax(86px,1fr))">${cells.join("")}</div></div>
    <p class="lo-lead" style="margin-top:10px">${esc(t("prac.slots", { n: d.slot_min }))} ${esc(t("prac.foot"))}</p>`;
  bar.bind(v);

  v.querySelector(".pgrid").onclick = (e) => {
    const book = e.target.closest("[data-book]");
    if (book) { const [c, s] = book.dataset.book.split("|"); return askBooking(d.day, c, s, () => viewPractice(v)); }
    const cx = e.target.closest("[data-cancel]");
    if (cx) return cancelBooking(Number(cx.dataset.cancel), () => viewPractice(v));
  };
}

function askBooking(day, court, start, done) {
  sheet(`${t("prac.book")} — ${court}`, `${dayLabel(day)} · ${start}`, `
    <label class="f">${esc(t("prac.name"))}
      <input id="bk-name" maxlength="60" value="${esc(store.name.get())}" />
    </label>
    <p class="err" id="bk-err"></p>`, async () => {
    const name = $("bk-name").value.trim();
    if (name.length < 2) { $("bk-err").textContent = t("prac.enterName"); return false; }
    const { data, error } = await sb.rpc("lo_book_practice",
      { p_day: day, p_court: court, p_start: start, p_name: name });
    if (error) { $("bk-err").textContent = error.message; return false; }
    store.name.set(name);
    // On retrouve l id de la reservation pour memoriser le jeton d annulation.
    // Deux places par creneau : sans filtrer sur celle que le serveur vient
    // d attribuer, la requete ramenerait deux lignes et echouerait.
    const { data: row } = await sb.from("lo_practice_bookings").select("id")
      .eq("day", day).eq("court", court).eq("start_time", start)
      .eq("seat", data.seat).single();
    if (row) store.add("bookings", row.id, data.token);
    done();
    return true;
  }, t("prac.book"));
}

async function cancelBooking(id, done) {
  const tok = store.get("bookings")[id];
  if (!tok) return;
  if (!confirm(t("prac.confirm"))) return;
  const { error } = await sb.rpc("lo_cancel_practice", { p_id: id, p_token: tok });
  if (error) { alert(error.message); return; }
  store.del("bookings", id);
  done();
}

/* ========================================= onglets SPARRING / ROOMMATE */
async function viewBoard(v) {
  const kind = state.cur;
  const p = kind === "sparring" ? "spar" : "room";
  const { data } = await sb.from("lo_posts").select("id,kind,author,body,created_at")
    .eq("kind", kind).order("created_at", { ascending: false }).limit(80);
  const list = data || [];
  const mine = store.get("posts");

  v.innerHTML = `
    <h2 class="lo-h2">${esc(t(p + ".title"))}</h2>
    <p class="lo-lead">${esc(t(p + ".lead"))}</p>
    <article class="card"><div class="card-in">
      <label class="f">${esc(t("prac.name"))}
        <input id="p-author" maxlength="60" value="${esc(store.name.get())}" /></label>
      <label class="f">${esc(t("board.msg"))}
        <textarea id="p-body" maxlength="500" placeholder="${esc(t(p + ".ph"))}"></textarea></label>
      <button class="btn block" id="p-send">${esc(t("board.post"))}</button>
      <p class="err" id="p-err"></p>
    </div></article>
    ${list.length ? list.map((x) => `
      <article class="post">
        <div class="post-top">
          <span class="post-av">${esc((x.author || "?").trim().charAt(0).toUpperCase() || "?")}</span>
          <b>${esc(x.author || t("board.anon"))}</b>
          <span class="msg-time">${ago(x.created_at)}</span>
        </div>
        <p>${esc(x.body)}</p>
        ${mine[x.id] ? `<button class="btn small danger" data-del="${x.id}">${esc(t("board.del"))}</button>` : ""}
      </article>`).join("")
    : `<div class="empty">${big("chat")}${esc(t("board.empty"))}</div>`}`;

  $("p-send").onclick = async () => {
    const author = $("p-author").value.trim();
    const body = $("p-body").value.trim();
    if (body.length < 3) { $("p-err").textContent = t("board.write"); return; }
    $("p-send").disabled = true;
    const { data: res, error } = await sb.rpc("lo_post", { p_kind: kind, p_author: author, p_body: body });
    $("p-send").disabled = false;
    if (error) { $("p-err").textContent = error.message; return; }
    store.name.set(author);
    const { data: row } = await sb.from("lo_posts").select("id").eq("kind", kind)
      .order("created_at", { ascending: false }).limit(1).single();
    if (row) store.add("posts", row.id, res.token);
    viewBoard(v);
  };

  v.onclick = async (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    const id = Number(b.dataset.del);
    const tok = store.get("posts")[id];
    if (!tok || !confirm(t("board.confirm"))) return;
    const { error } = await sb.rpc("lo_delete_post", { p_id: id, p_token: tok });
    if (error) { alert(error.message); return; }
    store.del("posts", id);
    viewBoard(v);
  };
}

/* ============================================ onglet PAELLA (soiree) */
async function viewPaella(v) {
  const { data } = await sb.from("lo_paella").select("id,name,guests,created_at")
    .order("created_at", { ascending: true });
  const liste = data || [];
  const couverts = liste.reduce((s, x) => s + 1 + (x.guests || 0), 0);
  const mien = store.get("paella");

  v.innerHTML = `
    <h2 class="lo-h2">${esc(t("pae.title"))}</h2>
    <p class="lo-lead">${esc(t("pae.lead"))}</p>
    <div class="free-note">${svg("wine", "mk")}<span>${esc(t("pae.free"))}</span></div>

    <article class="card"><div class="card-in">
      <h3>${ico("utensils")} ${esc(t("pae.join"))}</h3>
      <label class="f">${esc(t("prac.name"))}
        <input id="pa-name" maxlength="60" value="${esc(store.name.get())}" /></label>
      <label class="f">${esc(t("pae.guests"))}
        <select id="pa-guests">
          <option value="0">${esc(t("pae.alone"))}</option>
          <option value="1">+1</option><option value="2">+2</option><option value="3">+3</option>
        </select></label>
      <button class="btn block" id="pa-go">${esc(t("pae.join"))}</button>
      <p class="err" id="pa-err"></p>
    </div></article>

    <div class="sec-title">${svg("users", "mk")} ${esc(t("pae.who"))}
      <span style="margin-left:auto;font-size:.82rem;color:var(--fluo);font-weight:800">
        ${esc(t("pae.count", { n: couverts }))}</span></div>

    ${liste.length ? liste.map((p) => `
      <div class="pae-row">
        <span class="pae-av">${esc((p.name || "?").trim().charAt(0).toUpperCase())}</span>
        <b>${esc(p.name)}</b>
        ${p.guests ? `<span class="pae-plus">+${p.guests}</span>` : ""}
        ${mien[p.id] ? `<button class="btn small danger" data-out="${p.id}">${esc(t("pae.leave"))}</button>` : ""}
      </div>`).join("")
    : `<div class="empty">${big("utensils")}${esc(t("pae.empty"))}</div>`}`;

  $("pa-go").onclick = async () => {
    const nom = $("pa-name").value.trim();
    const inv = Number($("pa-guests").value);
    if (nom.length < 2) { $("pa-err").textContent = t("prac.enterName"); return; }
    $("pa-go").disabled = true;
    const { data: res, error } = await sb.rpc("lo_paella_join", { p_name: nom, p_guests: inv });
    $("pa-go").disabled = false;
    if (error) { $("pa-err").textContent = error.message; return; }
    store.name.set(nom);
    const { data: row } = await sb.from("lo_paella").select("id").eq("name", nom).maybeSingle();
    if (row) store.add("paella", row.id, res.token);
    viewPaella(v);
  };

  v.onclick = async (e) => {
    const b = e.target.closest("[data-out]");
    if (!b) return;
    const id = Number(b.dataset.out), tok = store.get("paella")[id];
    if (!tok || !confirm(t("pae.confirm"))) return;
    const { error } = await sb.rpc("lo_paella_leave", { p_id: id, p_token: tok });
    if (error) { alert(error.message); return; }
    store.del("paella", id);
    viewPaella(v);
  };
}

/* ------------------------------------------------------------ modale */
function sheet(title, sub, inner, onOk, okLabel) {
  const el = $("sheet");
  el.innerHTML = `<div class="sheet"><div class="sheet-in">
      <h3>${esc(title)}</h3><p class="sub">${esc(sub)}</p>
      ${inner}
      <div class="sheet-row">
        <button class="btn ghost" id="sh-no">${esc(t("c.cancel"))}</button>
        <button class="btn" id="sh-ok">${esc(okLabel)}</button>
      </div></div></div>`;
  const close = () => { el.innerHTML = ""; };
  $("sh-no").onclick = close;
  el.querySelector(".sheet").onclick = (e) => { if (e.target.classList.contains("sheet")) close(); };
  $("sh-ok").onclick = async () => {
    $("sh-ok").disabled = true;
    const ok = await onOk();
    const btn = $("sh-ok");
    if (btn) btn.disabled = false;
    if (ok !== false) close();
  };
  const first = el.querySelector("input,textarea");
  if (first) first.focus();
}

boot();
