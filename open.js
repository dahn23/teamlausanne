// =====================================================================
//  LAUSANNE OPEN — Player Hub (app joueurs)
//  Pas de login : lecture publique, écritures via des fonctions RPC
//  contrôlées côté base (voir db/06_lausanne_open.sql).
//  Tout le texte joueur est en ANGLAIS (tournoi international).
// =====================================================================
import { sb } from "./common.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ------------------------------------------------------------- dates */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const toDate = (s) => new Date(String(s).slice(0, 10) + "T00:00:00");
const dayLabel = (s) => { const d = toDate(s); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const dayShort = (s) => { const d = toDate(s); return `${DAYS[d.getDay()]}<br><b>${d.getDate()}</b>`; };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const hhmm = (t) => String(t || "").slice(0, 5);
function ago(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
  { id: "welcome",   label: "Welcome",       icon: "👋" },
  { id: "info",      label: "Official info", icon: "📣" },
  { id: "logistics", label: "Hotel & Food",  icon: "🚐" },
  { id: "oop",       label: "Order of play", icon: "📋" },
  { id: "practice",  label: "Practice",      icon: "🎾" },
  { id: "sparring",  label: "Sparring",      icon: "🤝" },
  { id: "roommate",  label: "Roommate",      icon: "🛏️" },
];

const state = { tabs: {}, settings: {}, cur: "welcome", sub: {}, timer: null };
const setting = (k, f, d = "") => (state.settings[k] && state.settings[k][f]) || d;

/* ===================================================================
   CONTENU STATIQUE — onglet Welcome
   (édité ici dans le code ; le reste vient du backend)
   =================================================================== */
const ITF_URL = "https://www.itftennis.com/en/tournament/m25-lausanne/sui/2026/m-itf-sui-2026-004/";

const WELCOME = [
  { id: "city", label: "Lausanne", html: `
    <div class="hero">
      <h2>Bienvenue à Lausanne</h2>
      <p>Welcome to the Olympic Capital — a city of hills between Lake Geneva and the vineyards,
         and the home of the Lausanne Open since the tournament began.</p>
      <div class="badges">
        <span class="badge fluo">Olympic Capital</span>
        <span class="badge">Lake Geneva</span>
        <span class="badge">Canton of Vaud</span>
      </div>
    </div>
    <div class="card">
      <h3><span class="ico">🏛️</span> The city in short</h3>
      <ul>
        <li>Capital of the canton of Vaud, around 140,000 inhabitants — the fourth largest city in Switzerland.</li>
        <li>Home of the <b>International Olympic Committee</b> since 1915, hence the name «&nbsp;Olympic Capital&nbsp;».</li>
        <li>Built on steep hills between the lake (373&nbsp;m) and the forest above (about 700&nbsp;m). Expect stairs.</li>
        <li>The old town is dominated by the <b>Gothic cathedral</b>. Every night between 22:00 and 02:00 a
            watchman still calls out the hours from the belfry — a tradition kept alive since 1405.</li>
        <li>French is the local language. English is widely spoken, especially by younger people.</li>
      </ul>
    </div>
    <div class="card">
      <h3><span class="ico">🚇</span> Getting around</h3>
      <ul>
        <li>The <b>m2 metro</b> is the only metro in Switzerland — it climbs from Ouchy on the lakefront up
            through the city centre. Fast, frequent, and worth the ride for the gradient alone.</li>
        <li>Ask at your hotel reception for the free <b>Lausanne Transport Card</b> — hotel guests normally
            travel free on buses and metro for the length of their stay.</li>
        <li>Taxis are expensive. Uber operates in the city.</li>
        <li>The club is at the <b>Plaines-du-Loup</b>, north of the centre — bus lines serve the Pontaise stadium.</li>
      </ul>
    </div>` },

  { id: "swiss", label: "Good to know", html: `
    <div class="card">
      <h3><span class="ico">🇨🇭</span> Practical Switzerland</h3>
      <div class="kv">
        <div><span>Currency</span><b>Swiss franc (CHF)</b></div>
        <div><span>Cards</span><b>Accepted almost everywhere</b></div>
        <div><span>Power</span><b>230 V · plug type J</b></div>
        <div><span>Language</span><b>French</b></div>
        <div><span>Time zone</span><b>CET / CEST</b></div>
      </div>
    </div>
    <div class="card">
      <h3><span class="ico">💡</span> Small things that help</h3>
      <ul>
        <li><b>Cash:</b> you will rarely need it. Contactless card and phone payment work everywhere,
            including in most bakeries and kiosks. Euros are sometimes accepted, but change comes in CHF.</li>
        <li><b>Plugs:</b> Swiss sockets are type J. A standard European two-pin plug fits without an adapter;
            a three-pin European plug does <i>not</i>.</li>
        <li><b>Water:</b> tap water is drinkable everywhere, including the street fountains. Fill your bottle.</li>
        <li><b>Tipping:</b> service is included. No tip is expected — rounding up is a friendly gesture, nothing more.</li>
        <li><b>Shops</b> close around 18:30–19:00 and stay closed on Sundays. The shops inside the main train
            station are the exception: open late and on Sundays.</li>
        <li><b>Trains</b> leave exactly on time. Be on the platform a couple of minutes early.</li>
      </ul>
    </div>
    <div class="card">
      <h3><span class="ico">🚑</span> Emergency numbers</h3>
      <div class="kv">
        <div><span>Ambulance</span><b><a href="tel:144">144</a></b></div>
        <div><span>Police</span><b><a href="tel:117">117</a></b></div>
        <div><span>Fire</span><b><a href="tel:118">118</a></b></div>
        <div><span>European emergency</span><b><a href="tel:112">112</a></b></div>
        <div><span>Tournament office</span><b><a href="tel:+41216461350">+41 21 646 13 50</a></b></div>
      </div>
      <p style="margin-top:10px">For anything medical during the tournament, speak to the tournament office
         first — a physiotherapist is on site during play.</p>
    </div>` },

  { id: "club", label: "The club", html: `
    <div class="card">
      <h3><span class="ico">🎾</span> Lausanne-Sports Tennis</h3>
      <p>The tournament is hosted by <b>Lausanne-Sports Tennis</b>, the historic tennis club of the city,
         founded in <b>1911</b> and established on the Plaines-du-Loup site, next to the Pontaise stadium,
         since 1954.</p>
      <div class="kv">
        <div><span>Address</span><b>Route des Plaines-du-Loup 7<br>1018 Lausanne</b></div>
        <div><span>Phone</span><b><a href="tel:+41216461350">+41 21 646 13 50</a></b></div>
        <div><span>Courts</span><b>12 (10 outdoor · 2 indoor)</b></div>
      </div>
      <p style="margin-top:12px">
        <a href="https://www.google.com/maps/search/?api=1&query=Route+des+Plaines-du-Loup+7+1018+Lausanne"
           target="_blank" rel="noopener">Open in Maps ↗</a>
      </p>
    </div>
    <div class="card">
      <h3><span class="ico">🍽️</span> Club-house &amp; restaurant</h3>
      <p>The club-house and its restaurant are open to players all week. A dedicated players menu is served
         during the tournament — see the <b>Hotel &amp; Food</b> tab.</p>
    </div>` },

  { id: "academy", label: "Academy", html: `
    <div class="card">
      <h3><span class="ico">🚀</span> Team Lausanne Academy</h3>
      <p>Team Lausanne is the performance academy based at the same site. It takes players from the first
         steps on court all the way to the professional circuit.</p>
      <ul>
        <li><b>Sport-études</b> — school and tennis combined, with academic supervision on site.</li>
        <li><b>Pro U18</b> — full-time training after compulsory school, built around the ITF junior circuit,
            with several weeks of tournaments abroad each year.</li>
        <li><b>Elite</b> — individual programmes for players competing on the professional circuit:
            training, physical and mental preparation, physiotherapy and travel logistics.</li>
      </ul>
      <p style="margin-top:10px"><a href="https://teamlausanne.netlify.app" target="_blank" rel="noopener">teamlausanne.netlify.app ↗</a></p>
    </div>` },

  { id: "open", label: "The Open", html: `
    <div class="hero">
      <h2>Lausanne Open 2026</h2>
      <p>The only international men's tennis tournament in the canton of Vaud. Professional tennis,
         at home, at the Plaines-du-Loup.</p>
      <div class="badges">
        <span class="badge fluo">ITF M25</span>
        <span class="badge">23–30 August 2026</span>
        <span class="badge">$30,000</span>
        <span class="badge">Free entry</span>
      </div>
    </div>
    <div class="card">
      <h3><span class="ico">🏆</span> 2025 champions</h3>
      <div class="kv">
        <div><span>Singles</span><b>🇨🇭 Henry Bernet</b></div>
        <div><span>Doubles</span><b>🇮🇪 Charles Barry<br>🇫🇷 Max Westphal</b></div>
      </div>
    </div>
    <div class="card">
      <h3><span class="ico">📅</span> Around the tournament</h3>
      <ul>
        <li>Entry is <b>free all week</b>, no ticket needed — invite whoever you like.</li>
        <li>School initiations, the Team Lausanne day on Saturday, and VIP lunches run alongside the draw.</li>
        <li>Draws, results and live scores are on the ITF website.</li>
      </ul>
      <p style="margin-top:10px"><a href="${ITF_URL}" target="_blank" rel="noopener">ITF tournament page ↗</a></p>
    </div>` },

  { id: "visit", label: "What to see", html: `
    <div class="card">
      <h3><span class="ico">🥇</span> The Olympic Museum</h3>
      <p>The obvious one, and genuinely good. On the lakefront in Ouchy, ten minutes from the centre by the
         m2 metro. The park and the terrace café are free even if you skip the museum.</p>
    </div>
    <div class="card">
      <h3><span class="ico">⛪</span> Cathedral &amp; old town</h3>
      <p>The 13th-century cathedral sits at the top of the old town — climb the tower for the best view over
         the lake and the Alps. Below it, narrow streets, the covered wooden staircase of the Marché,
         and Place de la Palud with its Saturday market.</p>
    </div>
    <div class="card">
      <h3><span class="ico">🌊</span> Ouchy &amp; the lake</h3>
      <p>The lakefront promenade is where Lausanne goes to breathe. Swim, paddle, or take a
         <b>CGN boat</b> — a beautiful ride across to Évian in France (bring your passport or ID).</p>
    </div>
    <div class="card">
      <h3><span class="ico">🍇</span> Lavaux vineyards</h3>
      <p>Twenty minutes east by train: terraced vineyards climbing from the water, a UNESCO World Heritage
         site. Get off at Cully or Rivaz and walk between the villages. The best afternoon you can have here.</p>
    </div>
    <div class="card">
      <h3><span class="ico">🏰</span> Chillon Castle</h3>
      <p>One hour by train, near Montreux: a medieval castle standing on a rock in the lake. Worth the trip
         on a rest day.</p>
    </div>
    <div class="card">
      <h3><span class="ico">🌲</span> Sauvabelin &amp; Plateforme 10</h3>
      <p>Above the city, the Sauvabelin lake and its wooden tower — 302 steps, a full view of the lake and the
         Alps. Next to the train station, <b>Plateforme 10</b> gathers three art museums in one modern district.</p>
    </div>
    <div class="card">
      <h3><span class="ico">🌙</span> In the evening</h3>
      <p>The <b>Flon</b> district — a former warehouse quarter turned into bars, restaurants and cinemas — is
         where the city goes out. Ten minutes on foot from the station.</p>
    </div>` },
];

/* ===================================================================
   Chargement des réglages + barre d'onglets
   =================================================================== */
async function boot() {
  const { data } = await sb.from("lo_settings").select("key,value");
  state.settings = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  state.tabs = state.settings.tabs || {};
  renderTabs();
  window.addEventListener("hashchange", route);
  route();
}

const visible = (id) => state.tabs[id] !== false;

function renderTabs() {
  $("tabs").innerHTML = TABS.filter((t) => visible(t.id)).map((t) =>
    `<button class="lo-tab" data-tab="${t.id}"><span>${t.icon}</span>${esc(t.label)}</button>`).join("");
  $("tabs").onclick = (e) => {
    const b = e.target.closest("[data-tab]");
    if (b) location.hash = "#" + b.dataset.tab;
  };
}

function route() {
  const want = (location.hash || "").replace("#", "") || "welcome";
  const list = TABS.filter((t) => visible(t.id)).map((t) => t.id);
  state.cur = list.includes(want) ? want : (list[0] || "welcome");
  document.querySelectorAll(".lo-tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === state.cur));
  if (state.timer) { clearInterval(state.timer); state.timer = null; }
  window.scrollTo(0, 0);
  render();
}

function render() {
  const v = $("view");
  v.onclick = null;
  v.innerHTML = `<span class="spin"></span>`;
  ({ welcome: viewWelcome, info: viewInfo, logistics: viewLogistics, oop: viewOop,
     practice: viewPractice, sparring: viewBoard, roommate: viewBoard }[state.cur] || viewWelcome)(v);
}

/* barre de sous-onglets réutilisable */
function subBar(key, items, onPick) {
  const cur = state.sub[key] || items[0].id;
  state.sub[key] = cur;
  const html = `<div class="lo-sub">${items.map((i) =>
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

/* =================================================== onglet WELCOME */
function viewWelcome(v) {
  const bar = subBar("welcome", WELCOME.map((w) => ({ id: w.id, label: w.label })), () => viewWelcome(v));
  const sec = WELCOME.find((w) => w.id === bar.cur) || WELCOME[0];
  v.innerHTML = bar.html + sec.html;
  bar.bind(v);
}

/* =============================================== onglet OFFICIAL INFO */
async function viewInfo(v) {
  const draw = async () => {
    const { data } = await sb.from("lo_messages").select("*")
      .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(60);
    const list = data || [];
    v.innerHTML = `
      <h2 class="lo-h2">Official information</h2>
      <p class="lo-lead">Announcements from the tournament desk: weather, delays, schedule changes.
         This page refreshes on its own — pull it up whenever something looks uncertain.</p>
      ${list.length ? list.map((m) => `
        <article class="msg ${esc(m.level)}">
          <div class="msg-top">
            ${m.pinned ? `<span class="pin">Pinned</span>` : ""}
            ${m.level !== "info" ? `<span class="msg-lvl">${m.level === "urgent" ? "Urgent" : "Important"}</span>` : ""}
            ${m.title ? `<b>${esc(m.title)}</b>` : ""}
            <span class="msg-time">${ago(m.created_at)}</span>
          </div>
          <p>${esc(m.body)}</p>
        </article>`).join("")
      : `<div class="empty"><span class="big">📣</span>No announcement yet.<br>Everything is running as scheduled.</div>`}`;
  };
  await draw();
  state.timer = setInterval(draw, 60000);   // rafraîchissement auto
}

/* ============================================ onglet HOTEL & FOOD */
async function viewLogistics(v) {
  const bar = subBar("log", [
    { id: "hotel", label: "🏨 Hotel" },
    { id: "shuttle", label: "🚐 Shuttle" },
    { id: "resto", label: "🍽️ Restaurant" },
  ], () => viewLogistics(v));

  let body = "";
  if (bar.cur === "hotel") {
    const maps = setting("hotel", "maps") ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(setting("hotel", "address"))}`;
    body = `
      <div class="card">
        <h3><span class="ico">🏨</span> ${esc(setting("hotel", "name", "Official hotel"))}</h3>
        <div class="kv">
          <div><span>Address</span><b>${esc(setting("hotel", "address")).replace(/, /g, "<br>")}</b></div>
          ${setting("hotel", "phone") ? `<div><span>Phone</span><b><a href="tel:${esc(setting("hotel", "phone").replace(/\s/g, ""))}">${esc(setting("hotel", "phone"))}</a></b></div>` : ""}
        </div>
        ${setting("hotel", "note") ? `<p style="margin-top:12px">${esc(setting("hotel", "note"))}</p>` : ""}
        <a class="btn block" style="margin-top:14px" href="${esc(maps)}" target="_blank" rel="noopener">Open in Maps</a>
      </div>`;
  } else if (bar.cur === "shuttle") {
    const { data } = await sb.from("lo_shuttle").select("*")
      .order("day", { ascending: true, nullsFirst: true }).order("sort").order("dep_time");
    const rows = data || [];
    const today = todayISO();
    const upcoming = rows.filter((r) => !r.day || r.day >= today);
    const groups = {};
    upcoming.forEach((r) => { (groups[r.day || "always"] ||= []).push(r); });
    const keys = Object.keys(groups).sort((a, b) => (a === "always" ? -1 : b === "always" ? 1 : a < b ? -1 : 1));
    body = upcoming.length ? keys.map((k) => `
      <div class="card">
        <h3><span class="ico">🚐</span> ${k === "always" ? "Every day" : dayLabel(k)}</h3>
        <div class="kv">
          ${groups[k].map((r) => `<div>
            <span>${esc(hhmm(r.dep_time))}${r.note ? ` · ${esc(r.note)}` : ""}</span>
            <b>${esc(r.from_place || "—")} → ${esc(r.to_place || "—")}</b>
          </div>`).join("")}
        </div>
      </div>`).join("")
      : `<div class="empty"><span class="big">🚐</span>The shuttle timetable is not published yet.<br>Check back later or ask at the tournament office.</div>`;
  } else {
    const { data } = await sb.from("lo_menu").select("*").eq("active", true).order("sort").order("id");
    const items = data || [];
    body = `
      <div class="card">
        <h3><span class="ico">🍽️</span> ${esc(setting("restaurant", "name", "Club restaurant"))}</h3>
        ${setting("restaurant", "address") ? `<p class="lo-lead" style="margin:0 0 12px">${esc(setting("restaurant", "address"))}</p>` : ""}
        <div class="kv">
          ${items.length ? items.map((m) => `<div>
            <span>${esc(m.name)}${m.description ? `<br><small style="opacity:.7">${esc(m.description)}</small>` : ""}</span>
            <b>${m.price != null ? `${Number(m.price).toFixed(2)} CHF` : ""}</b>
          </div>`).join("") : `<div><span>Menu not published yet</span><b></b></div>`}
        </div>
        ${setting("restaurant", "note") ? `<p style="margin-top:12px">${esc(setting("restaurant", "note"))}</p>` : ""}
      </div>`;
  }
  v.innerHTML = `<h2 class="lo-h2">Hotel, shuttle &amp; food</h2>` + bar.html + body;
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
  if (!days.length) {
    v.innerHTML = `<h2 class="lo-h2">Order of play</h2>
      <div class="empty"><span class="big">📋</span>The order of play is not published yet.<br>
      It is usually posted the evening before play.</div>`;
    return;
  }
  const bar = subBar("oop", days.map((d) => ({ id: d.day, label: dayLabel(d.day) })), () => viewOop(v));
  const pick = days.find((d) => d.day === bar.cur) || days[0];

  v.innerHTML = `<h2 class="lo-h2">Order of play</h2>
    <p class="lo-lead">Updated ${ago(pick.updated_at)}. Always check the official board at the tournament
       office before your match — the order of play can change.</p>
    ${bar.html}
    <div id="oop-box"><span class="spin"></span></div>`;
  bar.bind(v);

  const { data: full } = await sb.from("lo_oop").select("data,mime,filename").eq("day", pick.day).single();
  const box = $("oop-box");
  if (!full) { box.innerHTML = `<div class="empty">Could not load the file.</div>`; return; }
  const url = URL.createObjectURL(b64ToBlob(full.data, full.mime));
  const isImg = (full.mime || "").startsWith("image/");
  const small = window.matchMedia("(max-width: 760px)").matches;

  box.innerHTML = isImg
    ? `<div class="card" style="padding:8px"><img src="${url}" alt="Order of play" style="width:100%;border-radius:10px;display:block" /></div>
       <a class="btn block ghost" href="${url}" target="_blank" rel="noopener">Open full size</a>`
    : `<a class="btn block" href="${url}" target="_blank" rel="noopener">📄 Open the order of play</a>
       ${small ? "" : `<div class="card" style="padding:8px;margin-top:12px">
          <iframe src="${url}" title="Order of play" style="width:100%;height:70vh;border:0;border-radius:10px;background:#fff"></iframe></div>`}`;
}

/* ================================================== onglet PRACTICE */
async function viewPractice(v) {
  const today = todayISO();
  const now = Date.now();
  const { data } = await sb.from("lo_practice_days").select("*").gte("day", today).order("day");
  const days = (data || []).filter((d) => !d.visible_from || new Date(d.visible_from).getTime() <= now);

  const intro = `<h2 class="lo-h2">Practice courts</h2>
    <p class="lo-lead">${esc(setting("practice_intro", "text", "Book a practice slot. Enter the name you want to appear on the schedule."))}</p>
    <div class="card"><h3><span class="ico">🎾</span> Balls</h3>
      <p>${esc(setting("balls", "text", "Practice balls are available at the tournament office against an ID card as a deposit."))}</p></div>`;

  if (!days.length) {
    v.innerHTML = intro + `<div class="empty"><span class="big">🎾</span>No practice schedule is open right now.<br>
      The next day usually opens the evening before.</div>`;
    return;
  }

  const bar = subBar("prac", days.map((d) => ({ id: d.day, label: dayLabel(d.day) })), () => viewPractice(v));
  const d = days.find((x) => x.day === bar.cur) || days[0];

  const { data: bk } = await sb.from("lo_practice_bookings")
    .select("id,day,court,start_time,player_name").eq("day", d.day);
  const taken = {};
  (bk || []).forEach((b) => { taken[`${b.court}|${hhmm(b.start_time)}`] = b; });
  const mine = store.get("bookings");

  // créneaux
  const slots = [];
  const [h0, m0] = d.first_time.split(":").map(Number);
  const [h1, m1] = d.last_time.split(":").map(Number);
  for (let t = h0 * 60 + m0; t <= h1 * 60 + m1; t += d.slot_min) {
    slots.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  const courts = d.court_names || [];

  const cells = [`<div class="pcell hh"></div>`,
    ...courts.map((c) => `<div class="pcell hh">${esc(c)}</div>`)];
  slots.forEach((s) => {
    cells.push(`<div class="pcell th">${s}</div>`);
    courts.forEach((c) => {
      const b = taken[`${c}|${s}`];
      if (b) {
        const own = !!mine[b.id];
        cells.push(`<div class="pcell pslot ${own ? "mine" : "taken"}" ${own ? `data-cancel="${b.id}"` : ""}>
          ${esc(b.player_name)}${own ? `<small>tap to cancel</small>` : ""}</div>`);
      } else {
        cells.push(`<div class="pcell pslot" data-book="${esc(c)}|${s}">+</div>`);
      }
    });
  });

  v.innerHTML = intro + bar.html + `
    ${d.note ? `<div class="card"><p>${esc(d.note)}</p></div>` : ""}
    <div class="pg-wrap"><div class="pgrid"
      style="grid-template-columns:62px repeat(${courts.length},minmax(104px,1fr))">${cells.join("")}</div></div>
    <p class="lo-lead" style="margin-top:10px">Slots of ${d.slot_min} minutes. Your own bookings are highlighted —
       tap one to cancel it. Please free a slot you no longer need.</p>`;
  bar.bind(v);

  v.querySelector(".pgrid").onclick = (e) => {
    const book = e.target.closest("[data-book]");
    if (book) { const [c, s] = book.dataset.book.split("|"); return askBooking(d.day, c, s, () => viewPractice(v)); }
    const cx = e.target.closest("[data-cancel]");
    if (cx) return cancelBooking(Number(cx.dataset.cancel), () => viewPractice(v));
  };
}

function askBooking(day, court, start, done) {
  sheet(`Book ${court}`, `${dayLabel(day)} · ${start}`, `
    <label class="f">Your name
      <input id="bk-name" maxlength="60" placeholder="e.g. M. Federer" value="${esc(store.name.get())}" />
    </label>
    <p class="err" id="bk-err"></p>`, async () => {
    const name = $("bk-name").value.trim();
    if (name.length < 2) { $("bk-err").textContent = "Please enter your name."; return false; }
    const { data, error } = await sb.rpc("lo_book_practice",
      { p_day: day, p_court: court, p_start: start, p_name: name });
    if (error) { $("bk-err").textContent = error.message; return false; }
    store.name.set(name);
    // on retrouve l'id de la réservation pour mémoriser le jeton d'annulation
    const { data: row } = await sb.from("lo_practice_bookings").select("id")
      .eq("day", day).eq("court", court).eq("start_time", start).single();
    if (row) store.add("bookings", row.id, data.token);
    done();
    return true;
  }, "Book");
}

async function cancelBooking(id, done) {
  const tok = store.get("bookings")[id];
  if (!tok) return;
  if (!confirm("Cancel this practice slot?")) return;
  const { error } = await sb.rpc("lo_cancel_practice", { p_id: id, p_token: tok });
  if (error) { alert(error.message); return; }
  store.del("bookings", id);
  done();
}

/* ========================================= onglets SPARRING / ROOMMATE */
const BOARD = {
  sparring: {
    h: "Looking for a sparring partner",
    lead: "Post what you are looking for — level, time, court. Other players in the draw read this page.",
    ph: "e.g. Looking to hit tomorrow 10:00–11:30, ATP 600-900 level, I have a court booked.",
    empty: "No message yet. Be the first to post.",
  },
  roommate: {
    h: "Looking for a roommate",
    lead: "Share a room, split the cost. Post your dates and how to reach you.",
    ph: "e.g. Looking to share a twin room at the official hotel from Sun to Wed. WhatsApp +33 ...",
    empty: "No message yet. Be the first to post.",
  },
};

async function viewBoard(v) {
  const kind = state.cur;
  const cfg = BOARD[kind];
  const { data } = await sb.from("lo_posts").select("id,kind,author,body,created_at")
    .eq("kind", kind).order("created_at", { ascending: false }).limit(80);
  const list = data || [];
  const mine = store.get("posts");

  v.innerHTML = `
    <h2 class="lo-h2">${cfg.h}</h2>
    <p class="lo-lead">${cfg.lead}</p>
    <div class="card">
      <label class="f">Your name
        <input id="p-author" maxlength="60" placeholder="Name (or nickname)" value="${esc(store.name.get())}" /></label>
      <label class="f">Your message
        <textarea id="p-body" maxlength="500" placeholder="${esc(cfg.ph)}"></textarea></label>
      <button class="btn block" id="p-send">Post</button>
      <p class="err" id="p-err"></p>
    </div>
    ${list.length ? list.map((p) => `
      <article class="post">
        <div class="post-top">
          <span class="post-av">${esc((p.author || "?").trim().charAt(0).toUpperCase() || "?")}</span>
          <b>${esc(p.author || "Anonymous")}</b>
          <span class="msg-time">${ago(p.created_at)}</span>
        </div>
        <p>${esc(p.body)}</p>
        ${mine[p.id] ? `<button class="btn small danger" data-del="${p.id}">Delete my message</button>` : ""}
      </article>`).join("")
    : `<div class="empty"><span class="big">💬</span>${cfg.empty}</div>`}`;

  $("p-send").onclick = async () => {
    const author = $("p-author").value.trim();
    const body = $("p-body").value.trim();
    if (body.length < 3) { $("p-err").textContent = "Please write a message."; return; }
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
    if (!tok || !confirm("Delete your message?")) return;
    const { error } = await sb.rpc("lo_delete_post", { p_id: id, p_token: tok });
    if (error) { alert(error.message); return; }
    store.del("posts", id);
    viewBoard(v);
  };
}

/* ------------------------------------------------------------ modale */
function sheet(title, sub, inner, onOk, okLabel = "Confirm") {
  const el = $("sheet");
  el.innerHTML = `<div class="sheet"><div class="sheet-in">
      <h3>${esc(title)}</h3><p class="sub">${esc(sub)}</p>
      ${inner}
      <div class="sheet-row">
        <button class="btn ghost" id="sh-no">Cancel</button>
        <button class="btn" id="sh-ok">${esc(okLabel)}</button>
      </div></div></div>`;
  const close = () => { el.innerHTML = ""; };
  $("sh-no").onclick = close;
  el.querySelector(".sheet").onclick = (e) => { if (e.target.classList.contains("sheet")) close(); };
  $("sh-ok").onclick = async () => {
    $("sh-ok").disabled = true;
    const ok = await onOk();
    $("sh-ok").disabled = false;
    if (ok !== false) close();
  };
  const first = el.querySelector("input,textarea");
  if (first) first.focus();
}

boot();
