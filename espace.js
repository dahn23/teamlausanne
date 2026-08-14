// Mon espace — portail membre (jeunes & parents). 100% responsive.
import { sb } from "./common.js";

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
  renderYouthSelector();
  bindNav();
  bindBot();
  switchView("accueil");
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
const VIEW_TITLES = { accueil: "Accueil", cours: "Mes cours", reserver: "Réserver", stages: "Stages", profil: "Profil" };
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
   STAGES (inscription — renvoie vers la page stages)
   ============================================================ */
function renderStages() {
  $("view-stages").innerHTML = `
    <div class="pt-panel">
      <h2>Stages & camps</h2>
      <p class="muted">Inscris-toi aux prochains stages de l'académie.</p>
      <a class="pt-cta" href="index.html#stages">Voir les stages & s'inscrire</a>
    </div>`;
}

/* ============================================================
   PROFIL (mental/études publics — à venir)
   ============================================================ */
async function renderProfil() {
  const targets = selYouth === "all" ? YOUTHS : YOUTHS.filter((y) => y.person_id === selYouth);
  if (!targets.length) { $("view-profil").innerHTML = `<div class="pt-empty"><p>Aucun profil lié à ce compte.</p></div>`; return; }
  $("view-profil").innerHTML = `<p class="muted" style="text-align:center;padding:18px">Chargement…</p>`;

  const blocks = await Promise.all(targets.map(async (y) => {
    const [ment, etu] = await Promise.all([
      sb.from("mental_comments").select("body,author_name,created_at")
        .eq("youth_person_id", y.person_id).eq("channel", "public").order("created_at", { ascending: false }),
      sb.from("etudes_remarks").select("body,prof_name,created_at")
        .eq("youth_person_id", y.person_id).eq("channel", "public").order("created_at", { ascending: false }),
    ]);
    return { y, mental: ment.data || [], etudes: etu.data || [] };
  }));

  const item = (author, iso, body) => `
    <div class="pt-suivi-item">
      <div class="pt-suivi-meta">${author ? escHtml(author) + " · " : ""}${frShort((iso || "").slice(0, 10))}</div>
      <p>${escHtml(body).replace(/\n/g, "<br/>")}</p>
    </div>`;

  $("view-profil").innerHTML = blocks.map(({ y, mental, etudes }) => {
    let sections = "";
    if (mental.length) sections += `<div class="pt-suivi-sec"><div class="pt-suivi-h">🧠 Mental</div>${mental.map((m) => item(m.author_name, m.created_at, m.body)).join("")}</div>`;
    if (etudes.length) sections += `<div class="pt-suivi-sec"><div class="pt-suivi-h">📚 Études</div>${etudes.map((e) => item(e.prof_name, e.created_at, e.body)).join("")}</div>`;
    if (!sections) sections = `<p class="muted" style="padding:4px 2px">Aucun suivi partagé pour l'instant.</p>`;
    return `<div class="pt-prof">
      <div class="pt-prof-head">
        <div class="pt-youth-av big">${initials(y.first_name, y.last_name).toUpperCase()}</div>
        <div><b>${escHtml(y.first_name)} ${escHtml(y.last_name)}</b></div>
      </div>
      ${sections}
    </div>`;
  }).join("");
}
