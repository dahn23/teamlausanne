// Mon espace — portail membre (jeunes & parents). 100% responsive.
import { sb } from "./common.js";
import { ONESIGNAL_APP_ID } from "./config.js";

/* ============================================================
   PWA — installation + secours hors-ligne (service worker).
   ============================================================ */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW:", e));
  });
}

/* ============================================================
   Notifications push (OneSignal) — dormant tant que l'App ID
   n'est pas renseigné dans config.js. Aucun secret côté client :
   l'App ID est public ; la REST API key reste côté serveur.
   ============================================================ */
let pushReady = false;
function initPush(externalId) {
  if (!ONESIGNAL_APP_ID || pushReady) return;
  pushReady = true;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  const s = document.createElement("script");
  s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
  s.defer = true;
  document.head.appendChild(s);
  window.OneSignalDeferred.push(async (OneSignal) => {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        // Sous-scope pour le worker OneSignal → cohabite avec notre sw.js.
        serviceWorkerParam: { scope: "/push/onesignal/" },
        serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
      });
      if (externalId) await OneSignal.login(externalId); // cible ce compte
    } catch (e) { console.warn("OneSignal:", e); }
  });
}

/* ============================================================
   Mascotte — « Rebond », balle de tennis coéquipière.
   Réutilisée : écran de connexion + bouton assistant.
   ============================================================ */
function mascot(size = 88) {
  return `<svg class="mascot" viewBox="0 0 120 128" width="${size}" height="${size * 128 / 120}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="60" cy="120" rx="30" ry="6" fill="rgba(15,31,110,.14)"/>
    <!-- raquette -->
    <g transform="rotate(22 100 40)">
      <rect x="97" y="24" width="6" height="30" rx="3" fill="#0f1f6e"/>
      <ellipse cx="100" cy="18" rx="13" ry="16" fill="#eef1ff" stroke="#0f1f6e" stroke-width="4"/>
      <path d="M92 10v16M100 6v24M108 10v16M88 14h24M88 22h24" stroke="#c3ccf5" stroke-width="1.4"/>
    </g>
    <!-- bras -->
    <path d="M92 66 q10 -8 8 -22" fill="none" stroke="#0f1f6e" stroke-width="6" stroke-linecap="round"/>
    <path d="M26 70 q-14 4 -16 20" fill="none" stroke="#0f1f6e" stroke-width="6" stroke-linecap="round"/>
    <circle cx="10" cy="92" r="5" fill="#d8f200" stroke="#0f1f6e" stroke-width="3"/>
    <!-- corps balle -->
    <circle cx="58" cy="62" r="44" fill="#d8f200" stroke="#b6cc00" stroke-width="2"/>
    <path d="M20 40 q26 22 0 44" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    <path d="M96 40 q-26 22 0 44" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    <!-- bandeau -->
    <path d="M22 42 q36 -18 72 0" fill="none" stroke="#1e3ad1" stroke-width="10" stroke-linecap="round"/>
    <path d="M91 40 l12 -5 M91 46 l12 2" stroke="#1e3ad1" stroke-width="5" stroke-linecap="round"/>
    <!-- yeux -->
    <circle cx="46" cy="62" r="7" fill="#0f1f6e"/>
    <circle cx="72" cy="62" r="7" fill="#0f1f6e"/>
    <circle cx="48.5" cy="59.5" r="2.4" fill="#fff"/>
    <circle cx="74.5" cy="59.5" r="2.4" fill="#fff"/>
    <!-- joues + sourire -->
    <circle cx="38" cy="74" r="4.5" fill="rgba(255,90,90,.4)"/>
    <circle cx="80" cy="74" r="4.5" fill="rgba(255,90,90,.4)"/>
    <path d="M46 78 q13 12 26 0" fill="none" stroke="#0f1f6e" stroke-width="4.5" stroke-linecap="round"/>
  </svg>`;
}

/* ============================================================
   État
   ============================================================ */
let YOUTHS = [];        // jeunes liés au compte
let selYouth = "all";   // "all" ou person_id
let PLAYERS = [];       // jeunes "joueurs" (filières élite) → onglet Feuille de match
let weekStart = mondayOf(new Date());
let coursesCache = [];  // dernier chargement de la semaine

/* ============================================================
   Utilitaires dates
   ============================================================ */
const pad = (n) => String(n).padStart(2, "0");
const DOW = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
function isoLocal(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (x.getDay() + 6) % 7; // lundi = 0
  x.setDate(x.getDate() - diff);
  return x;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function frShort(iso) { const s = iso.split("-"); return `${s[2]}.${s[1]}`; }
function initials(f, l) { return ((f || "")[0] || "") + ((l || "")[0] || ""); }

/* ============================================================
   Amorçage
   ============================================================ */
const $ = (id) => document.getElementById(id);

(async function boot() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return showLogin();
  await startApp();
})();

/* ---------- Connexion ---------- */
function showLogin() {
  $("pt-app").classList.add("hidden");
  $("pt-login").classList.remove("hidden");
  $("pt-login-mascot").innerHTML = mascot(96);
}
$("pt-login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("pt-login-error");
  err.hidden = true;
  const btn = $("pt-login-btn");
  btn.disabled = true; btn.textContent = "Connexion…";
  const { error } = await sb.auth.signInWithPassword({
    email: $("pt-email").value.trim(),
    password: $("pt-password").value,
  });
  btn.disabled = false; btn.textContent = "Se connecter";
  if (error) { err.textContent = "Email ou mot de passe incorrect."; err.hidden = false; return; }
  await startApp();
});
$("pt-logout").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });

/* ---------- Démarrage de l'app ---------- */
async function startApp() {
  $("pt-login").classList.add("hidden");
  $("pt-app").classList.remove("hidden");
  $("pt-bot").innerHTML = mascot(40);
  $("pt-bot-avatar").innerHTML = mascot(28);

  const { data, error } = await sb.rpc("portal_my_youths");
  YOUTHS = error ? [] : (data || []);
  // Feuille de match : onglet visible seulement si un jeune du compte est "joueur" (filière élite).
  const { data: pl } = await sb.rpc("portal_player_youths");
  PLAYERS = pl || [];
  $("pt-nav-matchs").classList.toggle("hidden", PLAYERS.length === 0);
  renderYouthSelector();
  bindNav();
  bindBot();
  switchView("accueil");

  // Notifs push : cible le compte connecté (si OneSignal est configuré).
  const uid = (await sb.auth.getUser()).data.user?.id;
  if (uid) initPush(uid);
}

/* ---------- Sélecteur d'enfants ---------- */
function renderYouthSelector() {
  const box = $("pt-youths");
  if (YOUTHS.length <= 1) { box.classList.add("hidden"); box.innerHTML = ""; selYouth = YOUTHS[0]?.person_id || "all"; return; }
  box.classList.remove("hidden");
  const chip = (id, label, sub) =>
    `<button class="pt-youth ${selYouth === id ? "sel" : ""}" data-id="${id}">
       <span class="pt-youth-av">${sub}</span><span>${label}</span></button>`;
  let html = chip("all", "Tous", "★");
  for (const y of YOUTHS) html += chip(y.person_id, y.first_name, initials(y.first_name, y.last_name).toUpperCase());
  box.innerHTML = html;
  box.querySelectorAll(".pt-youth").forEach((b) =>
    b.addEventListener("click", () => { selYouth = b.dataset.id; renderYouthSelector(); renderCurrentView(); }));
}

/* ---------- Navigation (barre du bas) ---------- */
let currentView = "accueil";
const VIEW_TITLES = { accueil: "Accueil", cours: "Mes cours", matchs: "Feuille de match", reserver: "Réserver", stages: "Stages", profil: "Profil" };
function bindNav() {
  document.querySelectorAll(".pt-nav-item").forEach((b) =>
    b.addEventListener("click", () => switchView(b.dataset.view)));
}
function switchView(v) {
  currentView = v;
  document.querySelectorAll(".pt-nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  document.querySelectorAll(".pt-view").forEach((s) => s.classList.add("hidden"));
  $("view-" + v).classList.remove("hidden");
  $("pt-view-title").textContent = VIEW_TITLES[v] || "";
  window.scrollTo(0, 0);
  renderCurrentView();
}
function renderCurrentView() {
  if (currentView === "accueil") renderAccueil();
  else if (currentView === "cours") renderCours();
  else if (currentView === "matchs") renderMatchs();
  else if (currentView === "reserver") renderReserver();
  else if (currentView === "stages") renderStages();
  else if (currentView === "profil") renderProfil();
}

/* ---------- Assistant Rebond (scripté, sans IA) ---------- */
let botStarted = false;
function bindBot() {
  $("pt-bot").addEventListener("click", () => {
    const p = $("pt-bot-panel");
    p.classList.toggle("hidden");
    if (!p.classList.contains("hidden") && !botStarted) { botStarted = true; botGreet(); }
  });
  $("pt-bot-close").addEventListener("click", () => $("pt-bot-panel").classList.add("hidden"));
}
const closeBot = () => $("pt-bot-panel").classList.add("hidden");

function botBubble(html, who = "bot") {
  const log = $("pt-bot-log");
  const div = document.createElement("div");
  div.className = "pt-bub " + who;
  div.innerHTML = who === "bot"
    ? `<span class="pt-bub-av">${mascot(26)}</span><div class="pt-bub-txt">${html}</div>`
    : `<div class="pt-bub-txt">${html}</div>`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}
function botQuick(items) {
  const q = $("pt-bot-quick");
  q.innerHTML = "";
  for (const it of items) {
    const b = document.createElement("button");
    b.className = "pt-qr";
    b.textContent = it.label;
    b.addEventListener("click", () => {
      botBubble(escHtml(it.label), "me");
      q.innerHTML = "";
      setTimeout(() => it.run(), 140);
    });
    q.appendChild(b);
  }
}
const ROOT_QR = () => [
  { label: "📅 Mes prochains cours", run: qrCours },
  { label: "✅ M'annoncer à un cours", run: qrAnnonce },
  { label: "🎾 Réserver un court", run: qrReserver },
  { label: "🏕️ Stages", run: qrStages },
  { label: "🕘 Horaires secrétariat", run: qrSecret },
  { label: "📣 Voir les news", run: qrNews },
  { label: "☎️ Contacter le club", run: qrContact },
];
const backToRoot = () => botQuick(ROOT_QR());
const menuBtn = { label: "↩︎ Menu", run: backToRoot };

function botGreet() {
  const name = YOUTHS[0]?.first_name;
  botBubble(`Salut${name ? " " + escHtml(name) : ""} ! Je suis <b>Rebond</b> 🎾<br/>Comment puis-je t'aider ?`);
  backToRoot();
}

async function qrCours() {
  botBubble("Je regarde tes prochains cours…");
  const today = new Date();
  const { data } = await sb.rpc("portal_week_courses", { p_from: isoLocal(today), p_to: isoLocal(addDays(today, 14)) });
  let rows = data || [];
  if (selYouth !== "all") rows = rows.filter((c) => c.youth_id === selYouth);
  const now = new Date();
  rows = rows.filter((c) => new Date(`${c.course_date}T${c.start_time}:00`) >= now)
    .sort((a, b) => (a.course_date + a.start_time).localeCompare(b.course_date + b.start_time)).slice(0, 5);
  if (!rows.length) botBubble("Aucun cours prévu dans les 2 prochaines semaines. 🎾");
  else botBubble(rows.map((c) => {
    const dt = new Date(c.course_date + "T00:00:00");
    const w = (selYouth === "all" && YOUTHS.length > 1) ? " (" + escHtml(c.youth_first) + ")" : "";
    return `• <b>${DOW[dt.getDay()]} ${frShort(c.course_date)}</b> à ${c.start_time}${c.court ? " — " + escHtml(c.court) : ""}${w}`;
  }).join("<br/>"));
  botQuick([{ label: "Ouvrir mes cours", run: () => { closeBot(); switchView("cours"); } }, menuBtn]);
}
function qrAnnonce() {
  botBubble("Dans l'onglet <b>Cours</b>, tant que le cours n'a pas commencé, tu peux cliquer <b>Présent</b>, <b>En retard</b> ou <b>Absent</b>. Après le début, c'est la présence notée par ton coach qui s'affiche.");
  botQuick([{ label: "Ouvrir mes cours", run: () => { closeBot(); switchView("cours"); } }, menuBtn]);
}
function qrReserver() {
  botBubble("Tu peux réserver un court depuis l'onglet <b>Réserver</b>, ou directement sur la grille des courts.");
  botQuick([{ label: "Ouvrir la réservation", run: () => { location.href = "reservation.html"; } }, menuBtn]);
}
function qrStages() {
  botBubble("Retrouve tous les stages et camps de l'académie dans l'onglet <b>Stages</b>, avec l'inscription en ligne.");
  botQuick([{ label: "Voir les stages", run: () => { location.href = "index.html#stages"; } }, menuBtn]);
}
function qrSecret() {
  botBubble("Le secrétariat est ouvert du <b>lundi au vendredi</b>, <b>9h00–12h00</b> et <b>13h00–17h00</b>.");
  botQuick([{ label: "☎️ Contacter le club", run: qrContact }, menuBtn]);
}
function qrNews() { closeBot(); switchView("accueil"); }
function qrContact() {
  botBubble(`Téléphone : <a href="tel:+41216461350">+41 21 646 13 50</a><br/>Ou via le <a href="contact.html">formulaire de contact</a>.`);
  botQuick([menuBtn]);
}

/* ============================================================
   ACCUEIL (news — à venir)
   ============================================================ */
async function renderAccueil() {
  const who = YOUTHS.length ? YOUTHS.map((y) => y.first_name).join(", ") : "";
  $("view-accueil").innerHTML = `
    <div class="pt-hello">
      <div>${mascot(72)}</div>
      <div>
        <h2>Bienvenue${who ? " — " + who : ""}&nbsp;!</h2>
        <p class="muted">Les actualités du club, tes cours, et bientôt un assistant.</p>
      </div>
    </div>
    <div id="pt-news"><p class="muted" style="text-align:center;padding:20px">Chargement des news…</p></div>`;
  const { data, error } = await sb.rpc("portal_news");
  const news = error ? [] : (data || []);
  const box = document.getElementById("pt-news");
  if (!box) return;
  if (!news.length) { box.innerHTML = `<div class="pt-empty"><p>Aucune actualité pour le moment.</p></div>`; return; }
  box.innerHTML = news.map((n) => `
    <article class="pt-news-card">
      ${n.image_url ? `<img class="pt-news-img" src="${escHtml(n.image_url)}" alt="" loading="lazy" />` : ""}
      <div class="pt-news-body">
        <h3>${escHtml(n.title)}</h3>
        <div class="pt-news-date">${frShort((n.published_at || "").slice(0, 10))}</div>
        ${n.body ? `<p>${escHtml(n.body).replace(/\n/g, "<br/>")}</p>` : ""}
      </div>
    </article>`).join("");
}
function escHtml(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

/* ============================================================
   COURS — semaine, par jeune, avec auto-déclaration
   ============================================================ */
async function renderCours() {
  const from = isoLocal(weekStart), to = isoLocal(addDays(weekStart, 6));
  $("view-cours").innerHTML = `
    <div class="pt-week">
      <button class="pt-week-nav" id="wk-prev" aria-label="Semaine précédente">‹</button>
      <div class="pt-week-lbl">Semaine du ${frShort(from)} au ${frShort(to)}</div>
      <button class="pt-week-nav" id="wk-next" aria-label="Semaine suivante">›</button>
    </div>
    <div id="pt-cours-list"><p class="muted" style="text-align:center;padding:24px">Chargement…</p></div>`;
  $("wk-prev").addEventListener("click", () => { weekStart = addDays(weekStart, -7); renderCours(); });
  $("wk-next").addEventListener("click", () => { weekStart = addDays(weekStart, 7); renderCours(); });

  const { data, error } = await sb.rpc("portal_week_courses", { p_from: from, p_to: to });
  coursesCache = error ? [] : (data || []);
  drawCoursList();
}

function drawCoursList() {
  const list = $("pt-cours-list");
  if (!list) return;
  let rows = coursesCache;
  if (selYouth !== "all") rows = rows.filter((c) => c.youth_id === selYouth);
  if (!rows.length) {
    list.innerHTML = `<div class="pt-empty"><p>Aucun cours cette semaine.</p></div>`;
    return;
  }
  // groupé par jour
  const byDay = {};
  for (const c of rows) (byDay[c.course_date] ||= []).push(c);
  const days = Object.keys(byDay).sort();
  const now = new Date();
  let html = "";
  for (const d of days) {
    const dt = new Date(d + "T00:00:00");
    html += `<div class="pt-day">${DOW[dt.getDay()]} ${frShort(d)}</div>`;
    for (const c of byDay[d]) html += courseCard(c, now);
  }
  list.innerHTML = html;
  list.querySelectorAll(".pt-decl").forEach((b) =>
    b.addEventListener("click", () => declare(b.dataset.course, b.dataset.youth, b.dataset.status)));
}

const ST = {
  present: { lbl: "Présent", cls: "ok" },
  late:    { lbl: "En retard", cls: "late" },
  absent:  { lbl: "Absent", cls: "no" },
};
function courseCard(c, now) {
  const start = new Date(`${c.course_date}T${c.start_time}:00`);
  const before = now < start;
  const showYouth = selYouth === "all" && YOUTHS.length > 1;
  let control;
  if (before) {
    const btn = (s) => `<button class="pt-decl ${c.self_status === s ? "sel " + ST[s].cls : ""}"
        data-course="${c.course_id}" data-youth="${c.youth_id}" data-status="${s}">${ST[s].lbl}</button>`;
    control = `<div class="pt-decl-row">
        <span class="pt-decl-hint">Je m'annonce :</span>
        ${btn("present")}${btn("late")}${btn("absent")}
      </div>`;
  } else if (c.coach_status) {
    const s = ST[c.coach_status];
    control = `<div class="pt-mark ${s.cls}">Marqué par le coach : <b>${s.lbl}</b></div>`;
  } else {
    control = `<div class="pt-mark wait">Présence pas encore saisie</div>`;
  }
  return `<div class="pt-course" style="--c:${c.color || "#1e3ad1"}">
    <div class="pt-course-head">
      <div class="pt-course-time">${c.start_time}<span>${c.end_time}</span></div>
      <div class="pt-course-info">
        ${showYouth ? `<div class="pt-course-youth">${c.youth_first}</div>` : ""}
        <div class="pt-course-title">${c.title || "Cours"}</div>
        <div class="pt-course-meta">${c.court ? "📍 " + c.court : ""}${c.court && c.coach ? " · " : ""}${c.coach ? "👤 " + c.coach : ""}</div>
      </div>
    </div>
    ${control}
  </div>`;
}

async function declare(courseId, youthId, status) {
  const { error } = await sb.rpc("portal_set_self_report", { p_course_id: courseId, p_youth_id: youthId, p_status: status });
  if (error) { alert("Impossible d'enregistrer : " + (error.message || "")); return; }
  const c = coursesCache.find((x) => x.course_id === courseId && x.youth_id === youthId);
  if (c) c.self_status = status;
  drawCoursList();
}

/* ============================================================
   RÉSERVER (renvoie vers la grille publique)
   ============================================================ */
function renderReserver() {
  $("view-reserver").innerHTML = `
    <div class="pt-panel">
      <h2>Réserver un court</h2>
      <p class="muted">Accède à la grille des courts pour réserver ou jouer librement.</p>
      <a class="pt-cta" href="reservation.html">Ouvrir la réservation</a>
    </div>`;
}

/* ============================================================
   STAGES — inscription inline (mêmes tables que le site public)
   ============================================================ */
const stgDays = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
const stgEff = (p, d) => Math.round(Number(p) * Math.min(d, 5) / 5 * 100) / 100;
const frFull = (iso) => { const s = (iso || "").slice(0, 10).split("-"); return s.length === 3 ? `${s[2]}.${s[1]}.${s[0]}` : iso; };
let stgCats = {}, stgSessions = [], stgLinks = {}, stgSession = null;
const stgOpenCats = (s) => (stgLinks[s.id] || []).map((id) => stgCats[id]).filter(Boolean).sort((a, b) => (a.price || 0) - (b.price || 0));

async function loadStgData() {
  const [{ data: cs }, { data: ss }, { data: links }] = await Promise.all([
    sb.from("stage_categories").select("*"),
    sb.from("stage_sessions").select("*").order("start_date"),
    sb.from("stage_session_categories").select("session_id,category_id"),
  ]);
  stgCats = {}; for (const c of cs || []) stgCats[c.id] = c;
  stgLinks = {}; for (const l of links || []) (stgLinks[l.session_id] = stgLinks[l.session_id] || []).push(l.category_id);
  stgSessions = (ss || []).filter((s) => (stgLinks[s.id] || []).length);
}

async function renderStages() {
  $("view-stages").innerHTML = `<p class="muted" style="text-align:center;padding:20px">Chargement…</p>`;
  await loadStgData();
  drawStgList();
}
function drawStgList() {
  const v = $("view-stages");
  if (!stgSessions.length) { v.innerHTML = `<div class="pt-empty"><p>Aucun stage ouvert aux inscriptions pour le moment. Reviens bientôt !</p></div>`; return; }
  v.innerHTML = stgSessions.map((s) => {
    const d = stgDays(s.start_date, s.end_date), oc = stgOpenCats(s);
    const prices = oc.map((c) => stgEff(c.price || 0, d));
    const priceLbl = prices.length ? (Math.min(...prices) === Math.max(...prices) ? `${prices[0]} CHF` : `dès ${Math.min(...prices)} CHF`) : "—";
    const img = s.image_url || oc.find((c) => c.image_url)?.image_url;
    const dates = s.start_date === s.end_date ? frFull(s.start_date) : `${frFull(s.start_date)} → ${frFull(s.end_date)}`;
    return `<article class="pt-stg-card">
      ${img ? `<img class="pt-stg-img" src="${escHtml(img)}" alt="" loading="lazy"/>` : ""}
      <div class="pt-stg-body">
        <h3>${escHtml(s.title || "Stage")}</h3>
        <div class="pt-stg-dates">${dates} · ${d} jour${d > 1 ? "s" : ""}</div>
        <div class="pt-stg-badges">${oc.map((c) => `<span class="pt-stg-tag">${escHtml(c.name)}</span>`).join("")}</div>
        <div class="pt-stg-foot"><span class="pt-stg-price">${priceLbl}</span>
          <button class="pt-cta sm" data-stg="${s.id}">S'inscrire</button></div>
      </div></article>`;
  }).join("");
  v.querySelectorAll("[data-stg]").forEach((b) => b.addEventListener("click", () => openStgForm(b.dataset.stg)));
}

async function openStgForm(id) {
  stgSession = stgSessions.find((s) => s.id === id);
  const oc = stgOpenCats(stgSession);
  const acctEmail = (await sb.auth.getUser()).data.user?.email || "";
  const youthOpts = YOUTHS.map((y) => `<option value="${y.person_id}">${escHtml(y.first_name)} ${escHtml(y.last_name)}</option>`).join("");
  const catOpts = oc.map((c) => `<option value="${c.id}">${escHtml(c.name)} — ${stgEff(c.price || 0, stgDays(stgSession.start_date, stgSession.end_date))} CHF</option>`).join("");
  $("view-stages").innerHTML = `
    <button class="pt-back-btn" id="stg-back">← Retour aux stages</button>
    <div class="pt-panel" style="text-align:left">
      <h2 style="margin:0 0 4px">${escHtml(stgSession.title || "Stage")}</h2>
      <div id="stg-meta" class="muted" style="margin-bottom:10px"></div>
      <form id="stg-form" class="pt-form">
        ${YOUTHS.length ? `<label>Participant<select id="sf-youth">${youthOpts}<option value="__other">Autre (préciser)</option></select></label>` : ""}
        <div class="pt-form-row">
          <label>Prénom<input id="sf-first" required/></label>
          <label>Nom<input id="sf-last" required/></label>
        </div>
        <div class="pt-form-row">
          <label>Email<input id="sf-email" type="email" value="${escHtml(acctEmail)}"/></label>
          <label>Date de naissance<input id="sf-birth" type="date"/></label>
        </div>
        <label>Catégorie<select id="sf-cat">${catOpts}</select></label>
        <label id="sf-tshirt-wrap" class="hidden">Taille de t-shirt (offert)<select id="sf-tshirt"><option value="">— choisir —</option><option>4-6 ans</option><option>8-10 ans</option><option>12-14 ans</option><option>S</option><option>M</option><option>L</option><option>XL</option></select></label>
        <div id="sf-meal-wrap" class="hidden">
          <span class="pt-form-lbl">Restriction / allergie alimentaire</span>
          <label class="pt-radio"><input type="radio" name="sfmeal" value="aucune" checked/> Aucune</label>
          <label class="pt-radio"><input type="radio" name="sfmeal" value="autre"/> À préciser :</label>
          <input id="sf-meal-text" placeholder="Allergie, régime…" disabled/>
        </div>
        <label id="sf-rank-wrap" class="hidden">Classement tennis<input id="sf-rank" placeholder="ex. R4, N3, sans classement…"/></label>
        <label id="sf-addon-wrap" class="hidden pt-addon"><input type="checkbox" id="sf-addon"/> <span id="sf-addon-label"></span></label>
        <label>Commentaire (optionnel)<textarea id="sf-comment" rows="3"></textarea></label>
        <button type="submit" id="sf-submit">Envoyer mon inscription</button>
        <p id="sf-error" class="error" hidden></p>
      </form>
      <div id="stg-done" class="hidden pt-empty">
        <p style="font-size:1.1rem">Inscription reçue, merci !</p>
        <p class="muted">Tu recevras un email de confirmation avec la facture.</p>
      </div>
    </div>`;
  $("stg-back").addEventListener("click", drawStgList);
  const applyChild = () => {
    const yid = $("sf-youth")?.value;
    if (yid && yid !== "__other") {
      const y = YOUTHS.find((x) => x.person_id === yid);
      $("sf-first").value = y.first_name; $("sf-last").value = y.last_name;
      $("sf-first").readOnly = true; $("sf-last").readOnly = true;
    } else {
      $("sf-first").readOnly = false; $("sf-last").readOnly = false;
      if (yid === "__other") { $("sf-first").value = ""; $("sf-last").value = ""; }
    }
  };
  if ($("sf-youth")) { $("sf-youth").addEventListener("change", applyChild); applyChild(); }
  $("sf-cat").addEventListener("change", applyStgCat);
  $("sf-addon").addEventListener("change", applyStgCat);
  document.querySelectorAll('input[name="sfmeal"]').forEach((r) =>
    r.addEventListener("change", () => { $("sf-meal-text").disabled = document.querySelector('input[name="sfmeal"]:checked').value !== "autre"; }));
  $("stg-form").addEventListener("submit", submitStg);
  applyStgCat();
}
function applyStgCat() {
  const c = stgCats[$("sf-cat").value] || {};
  const d = stgDays(stgSession.start_date, stgSession.end_date), base = stgEff(c.price || 0, d);
  const addon = Number(c.private_addon_price) || 0;
  $("sf-addon-wrap").classList.toggle("hidden", !addon);
  if (addon) $("sf-addon-label").textContent = `Ajouter 3h de tennis privé (+${addon} CHF)`; else $("sf-addon").checked = false;
  const price = base + (addon && $("sf-addon").checked ? addon : 0);
  const dates = `${frFull(stgSession.start_date)}${stgSession.end_date !== stgSession.start_date ? " → " + frFull(stgSession.end_date) : ""}`;
  $("stg-meta").innerHTML = `${dates} · ${d} jour${d > 1 ? "s" : ""} · <b>${price} CHF</b>`;
  $("sf-tshirt-wrap").classList.toggle("hidden", !c.tshirt);
  $("sf-meal-wrap").classList.toggle("hidden", !c.meal);
  $("sf-rank-wrap").classList.toggle("hidden", !c.ask_ranking);
}
async function submitStg(e) {
  e.preventDefault();
  const err = $("sf-error"); err.hidden = true;
  const c = stgCats[$("sf-cat").value] || {};
  if (!c.id) { err.textContent = "Choisis une catégorie."; err.hidden = false; return; }
  let meal = null;
  if (c.meal) { const sel = document.querySelector('input[name="sfmeal"]:checked')?.value; meal = sel === "autre" ? ($("sf-meal-text").value.trim() || "À préciser") : "Aucune"; }
  const addon = Number(c.private_addon_price) || 0;
  const yid = $("sf-youth")?.value;
  const first = $("sf-first").value.trim(), last = $("sf-last").value.trim();
  if (!first || !last) { err.textContent = "Prénom et nom requis."; err.hidden = false; return; }
  const row = {
    stage_id: stgSession.id, category_id: c.id, first_name: first, last_name: last,
    email: $("sf-email").value.trim() || null, birth_date: $("sf-birth").value || null,
    tshirt_size: c.tshirt ? ($("sf-tshirt").value || null) : null, meal_restriction: meal,
    ranking: c.ask_ranking ? ($("sf-rank").value.trim() || null) : null,
    private_addon: addon > 0 && $("sf-addon").checked,
    comment: $("sf-comment").value.trim() || null,
    person_id: (yid && yid !== "__other") ? yid : null,
  };
  const btn = $("sf-submit"); btn.disabled = true; btn.textContent = "Envoi…";
  const { error } = await sb.from("stage_registrations").insert(row);
  if (error) { err.textContent = "Erreur : " + error.message; err.hidden = false; btn.disabled = false; btn.textContent = "Envoyer mon inscription"; return; }
  $("stg-form").classList.add("hidden"); $("stg-done").classList.remove("hidden");
  $("stg-meta").textContent = "";
}

/* ============================================================
   PROFIL (mental/études publics — à venir)
   ============================================================ */
function renderProfil() {
  const targets = selYouth === "all" ? YOUTHS : YOUTHS.filter((y) => y.person_id === selYouth);
  if (!targets.length) { $("view-profil").innerHTML = `<div class="pt-empty"><p>Aucun profil lié à ce compte.</p></div>`; return; }
  // Le suivi (mental/études) est désormais un fil INTERNE à l'encadrement : plus affiché ici.
  $("view-profil").innerHTML = targets.map((y) => `
    <div class="pt-prof">
      <div class="pt-prof-head">
        <div class="pt-youth-av big">${initials(y.first_name, y.last_name).toUpperCase()}</div>
        <div><b>${escHtml(y.first_name)} ${escHtml(y.last_name)}</b></div>
      </div>
    </div>`).join("");
}

/* ============================================================
   Feuille de match — côté joueur/joueuse
   ============================================================ */
const MRP_RANKINGS = ["r9", "r8", "r7", "r6", "r5", "r4", "r3", "r2", "r1", "n4", "n3", "n2", "n1", "autre"];
const MRP_RATINGS = [
  ["r_attitude", "Attitude sur le terrain"], ["r_mindset", "État d'esprit positif"],
  ["r_legs", "Intensité des jambes"], ["r_relax", "Relâchement"],
  ["r_objectives", "Tenir les objectifs"], ["r_combative", "Combatif"],
];
const MR_KEYS = ["strategy_pre", "opp_sw", "opp_style", "how_won", "how_lost", "did_well", "to_improve", "three_positives"];
function mrpLabels(role, gender) {
  const il = gender === "F" ? "elle" : "il";
  const base = {
    strategy_pre: "Stratégie d'avant match", opp_sw: "Forces et faiblesses de l'adversaire",
    opp_style: "Style de jeu de l'adversaire", three_positives: "3 choses positives de ce match",
  };
  if (role === "joueur") return {
    ...base, how_won: "Comment j'ai gagné la majorité des points", how_lost: "Comment j'ai perdu la majorité des points",
    did_well: "Ce que j'ai bien réussi à faire", to_improve: "Ce que je dois améliorer",
  };
  return {
    ...base, how_won: `Comment ${il} a gagné la majorité des points`, how_lost: `Comment ${il} a perdu la majorité des points`,
    did_well: `Ce qu'${il} a bien réussi à faire`, to_improve: `Ce qu'${il} doit améliorer`,
  };
}

let mrpSel = null;
function renderMatchs() {
  const host = $("view-matchs");
  if (!PLAYERS.length) { host.innerHTML = `<div class="pt-empty"><p>La feuille de match est réservée aux joueurs de compétition.</p></div>`; return; }
  if (!mrpSel || !PLAYERS.some((p) => p.person_id === mrpSel))
    mrpSel = (selYouth !== "all" && PLAYERS.some((p) => p.person_id === selYouth)) ? selYouth : PLAYERS[0].person_id;
  const player = PLAYERS.find((p) => p.person_id === mrpSel);
  const fem = player.gender === "F";
  const selHtml = PLAYERS.length > 1
    ? `<div class="mrp-players">${PLAYERS.map((p) => `<button class="mrp-player ${p.person_id === mrpSel ? "sel" : ""}" data-id="${p.person_id}">${escHtml(p.first_name)}</button>`).join("")}</div>` : "";
  const rankOpts = MRP_RANKINGS.map((r) => `<option value="${r}">${r === "autre" ? "Autre" : r.toUpperCase()}</option>`).join("");
  const L = mrpLabels("joueur", player.gender);
  host.innerHTML = `
    ${selHtml}
    <div class="mrp-card">
      <h2 class="mrp-h">Remplir en tant que ${fem ? "joueuse" : "joueur"}</h2>
      <div class="mrp-grid">
        <label>Date du match<input type="date" id="mrp-date"></label>
        <label>Adversaire<input type="text" id="mrp-opponent"></label>
        <label>Classement adversaire<select id="mrp-rank"><option value="">—</option>${rankOpts}</select></label>
        <label>Résultat<select id="mrp-result"><option value="gagne">Gagné</option><option value="perdu">Perdu</option></select></label>
        <label>Score<input type="text" id="mrp-score" placeholder="ex. 6-3 6-4"></label>
      </div>
      <div class="mrp-texts">${MR_KEYS.map((k) => `<label>${escHtml(L[k])}<textarea id="mrp-${k}" rows="2"></textarea></label>`).join("")}</div>
      <div class="mrp-ratings">${MRP_RATINGS.map(([k, l]) => `<div class="mrp-rate"><span>${escHtml(l)}</span><div class="mrp-stars" data-k="${k}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="mrp-star" data-v="${n}">${n}</button>`).join("")}</div></div>`).join("")}</div>
      <label class="mrp-comment">Commentaire<textarea id="mrp-comment" rows="2"></textarea></label>
      <div class="mrp-actions"><button type="button" id="mrp-save">Enregistrer ma feuille</button><span id="mrp-status" class="muted"></span></div>
    </div>
    <div id="mrp-hist"><p class="muted" style="text-align:center;padding:12px">Chargement…</p></div>`;
  $("mrp-date").value = isoLocal(new Date());
  host.querySelectorAll(".mrp-player").forEach((b) => b.addEventListener("click", () => { mrpSel = b.dataset.id; renderMatchs(); }));
  host.querySelectorAll(".mrp-stars").forEach((box) => box.querySelectorAll(".mrp-star").forEach((b) => b.addEventListener("click", () => {
    box.dataset.val = b.dataset.v;
    box.querySelectorAll(".mrp-star").forEach((x) => x.classList.toggle("on", Number(x.dataset.v) <= Number(b.dataset.v)));
  })));
  $("mrp-save").addEventListener("click", () => saveMatchReportPortal(player));
  loadPortalMatchHist(player);
}

async function saveMatchReportPortal(player) {
  const rating = (k) => { const el = document.querySelector(`.mrp-stars[data-k="${k}"]`); return el && el.dataset.val ? Number(el.dataset.val) : null; };
  const payload = {
    match_date: $("mrp-date").value || null, opponent: $("mrp-opponent").value.trim(),
    opponent_ranking: $("mrp-rank").value, result: $("mrp-result").value,
    score: $("mrp-score").value.trim(), comment: $("mrp-comment").value.trim(),
  };
  for (const k of MR_KEYS) payload[k] = $("mrp-" + k).value.trim();
  for (const [k] of MRP_RATINGS) payload[k] = rating(k);
  $("mrp-status").textContent = "Enregistrement…";
  const { error } = await sb.rpc("portal_save_match_report", { p_youth: player.person_id, p_data: payload });
  if (error) { $("mrp-status").textContent = "Erreur : " + error.message; return; }
  renderMatchs();
}

async function loadPortalMatchHist(player) {
  const host = $("mrp-hist"); if (!host) return;
  const { data } = await sb.rpc("portal_match_reports", { p_youth: player.person_id });
  const rows = data || [];
  const wins = rows.filter((r) => r.result === "gagne").length, losses = rows.filter((r) => r.result === "perdu").length;
  const cR = rows.filter((r) => r.author_role === "coach"), jR = rows.filter((r) => r.author_role === "joueur");
  const avg = (list, k) => { const v = list.map((r) => r[k]).filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; };
  const hasComp = cR.length && jR.length;
  const bar = (v, cls) => `<div class="mrp-bar"><div class="mrp-bar-fill ${cls}" style="width:${(v || 0) / 5 * 100}%"></div></div>`;
  const comp = MRP_RATINGS.map(([k, l]) => {
    const c = avg(cR, k), j = avg(jR, k);
    return `<div class="mrp-comp"><span class="mrp-comp-l">${escHtml(l)}</span>
      <div class="mrp-comp-line"><span class="mrp-tag coach">Coach ${c ?? "—"}</span>${bar(c, "coach")}</div>
      <div class="mrp-comp-line"><span class="mrp-tag joueur">Moi ${j ?? "—"}</span>${bar(j, "joueur")}</div></div>`;
  }).join("");
  host.innerHTML = `
    <div class="mrp-stats"><div class="mrp-stat ok"><b>${wins}</b><span>gagnés</span></div><div class="mrp-stat no"><b>${losses}</b><span>perdus</span></div><div class="mrp-stat"><b>${rows.length}</b><span>feuilles</span></div></div>
    ${hasComp ? `<h3 class="mrp-h2">Ma vision vs celle du coach</h3><div class="mrp-comp-wrap">${comp}</div>` : ""}
    <h3 class="mrp-h2">Feuilles</h3>
    ${rows.length ? rows.map((r) => mrpReportCard(r, player)).join("") : `<p class="muted" style="padding:4px 2px">Aucune feuille pour l'instant.</p>`}`;
}

function mrpReportCard(r, player) {
  const L = mrpLabels(r.author_role, player.gender);
  const texts = MR_KEYS.filter((k) => r[k]).map((k) => `<div class="mrp-field"><b>${escHtml(L[k])}</b><p>${escHtml(r[k]).replace(/\n/g, "<br/>")}</p></div>`).join("");
  return `<div class="mrp-report">
    <div class="mrp-report-head">
      <span class="mrp-badge ${r.author_role}">${r.author_role === "coach" ? "Coach" : "Moi"}</span>
      <b>vs ${escHtml(r.opponent || "—")}</b>${r.opponent_ranking ? ` (${escHtml(r.opponent_ranking.toUpperCase())})` : ""}
      <span class="${r.result === "gagne" ? "mrp-win" : "mrp-loss"}">${r.result === "gagne" ? "Gagné" : "Perdu"} ${escHtml(r.score || "")}</span>
      <span class="muted">${r.match_date ? frShort(r.match_date.slice(0, 10)) : ""}</span>
    </div>
    ${texts}
    ${r.comment ? `<div class="mrp-field"><b>Commentaire</b><p>${escHtml(r.comment).replace(/\n/g, "<br/>")}</p></div>` : ""}
  </div>`;
}
