// Mon espace — portail membre (jeunes & parents). 100% responsive.
import { sb, myRoles, hasAny, CONSOLE_ROLES, isGzManager, rememberSpace, initNativePush, releaseNativePush, openDeleteAccount } from "./common.js";
import { ONESIGNAL_APP_ID, SITE_PUBLIC, SAISON_COURS, RESEAUX } from "./config.js";

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
   Visuel de l'app — logo Team Lausanne Academy.
   (Remplace l'ancienne mascotte « balle » partout : connexion, assistant, bulles.
   Décision Dan 23.09.2026 : plus de balle nulle part.)
   ============================================================ */
function mascot(size = 88) {
  return `<img class="mascot" src="assets/logo-academie.webp" alt="Team Lausanne" width="${size}" height="${size}" style="width:${size}px;height:${size}px;object-fit:contain" />`;
}

/* ============================================================
   État
   ============================================================ */
let YOUTHS = [];        // jeunes liés au compte
let selYouth = "all";   // "all" ou person_id
let PLAYERS = [];       // jeunes "joueurs" (filières élite) → onglet Feuille de match
let ELITE = new Set();  // parmi eux : pro, pro U18, sport-études (db/118) → chat Prépa physique, Mental complet, pas de Stages
// Aperçu depuis la console : « espace.html?apercu=<id du jeune> ». Le cadre de
// téléphone de l'onglet Accès montre alors l'app telle qu'une famille la voit,
// sans sortir son téléphone ni se connecter à la place de quelqu'un.
//
// Le droit n'est PAS décidé ici : les fonctions du portail refusent elles-mêmes
// de répondre à qui n'est ni admin ni secrétariat (portal_peut_apercevoir,
// db/187). Ce paramètre ne donne donc rien à qui n'y a pas déjà droit — une
// famille qui le taperait dans la barre d'adresse verrait son propre espace.
const APERCU = new URLSearchParams(location.search).get("apercu");
let weekStart = mondayOf(new Date());
let coursesCache = [];  // dernier chargement de la semaine
let etudesCache = [];   // jours d'études de la semaine (13h-17h)

// Petites icônes (court / coach / études) pour les cartes de cours.
const IC_COURT = '<svg viewBox="0 0 24 24" class="pt-ic" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 12h18M12 5v14"/></svg>';
const IC_COACH = '<svg viewBox="0 0 24 24" class="pt-ic" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.4 3.1-5.2 7-5.2s7 1.8 7 5.2"/></svg>';
const IC_STUDY = '<svg viewBox="0 0 24 24" class="pt-ic" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 4 2 9l10 5 10-5-10-5z"/><path d="M6 11v4c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4v-4"/></svg>';

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
$("pt-logout").addEventListener("click", async () => { await releaseNativePush(); await sb.auth.signOut(); location.reload(); });

/* ---------- Démarrage de l'app ---------- */
async function startApp() {
  $("pt-login").classList.add("hidden");
  $("pt-app").classList.remove("hidden");
  $("pt-bot").innerHTML = mascot(40);
  $("pt-bot-avatar").innerHTML = mascot(28);

  // En aperçu, les trois réponses qui donnent sa forme à l'app viennent d'un
  // seul appel, et c'est la BASE qui dit si ce jeune est joueur ou élite —
  // pas une copie des règles ici, qui divergerait tôt ou tard de l'originale.
  const apercu = APERCU ? (await sb.rpc("portal_apercu_profil", { p_youth: APERCU })).data?.[0] : null;
  if (APERCU && !apercu) { $("pt-app").innerHTML = '<p style="padding:24px">Aperçu indisponible : droits insuffisants, ou élève introuvable.</p>'; return; }

  const { data, error } = apercu ? { data: [apercu] } : await sb.rpc("portal_my_youths");
  YOUTHS = error ? [] : (data || []);
  if (!apercu) initNativePush();   // app native : enregistre ce téléphone pour les notifications (sans effet dans un navigateur)
  // Compte qui a aussi un rôle staff (coach qui est joueur, parent qui est moniteur…) : bouton de bascule vers la console.
  // Bouton « ⇄ Staff » : inutile dans un aperçu, où l'on est déjà dans la console.
  if (!apercu) myRoles().then(async (roles) => {
    // Rôle staff, ou responsable d'un tournoi GameZone en cours : la console lui est ouverte.
    if (!hasAny(roles, CONSOLE_ROLES) && !(await isGzManager())) return;
    const b = $("pt-to-console"); b.classList.remove("hidden");
    b.addEventListener("click", () => { rememberSpace("console"); location.href = "/console"; });
  });
  // Feuille de match : onglet visible seulement si un jeune du compte est "joueur" (filière élite).
  const { data: pl } = apercu
    ? { data: apercu.est_joueur ? [apercu] : [] }
    : await sb.rpc("portal_player_youths");
  PLAYERS = pl || [];
  $("pt-nav-matchs").classList.toggle("hidden", PLAYERS.length === 0);
  $("pt-nav-comp").classList.toggle("hidden", PLAYERS.length === 0);
  $("pt-nav-feuille").classList.toggle("hidden", PLAYERS.length === 0);
  $("pt-nav-physique").classList.toggle("hidden", PLAYERS.length === 0);
  const { data: el } = apercu
    ? { data: apercu.est_elite ? [apercu.person_id] : [] }
    : await sb.rpc("portal_elite_youths");
  ELITE = new Set((el || []).map((x) => (typeof x === "string" ? x : x.portal_elite_youths)));
  // Stages : pas pour pro, pro U18 et sport-études (seulement si tous les jeunes du compte en sont).
  document.querySelector('.pt-nav-item[data-view="stages"]')?.classList.toggle("hidden", YOUTHS.length > 0 && YOUTHS.every((y) => ELITE.has(y.person_id)));
  arrangeNav();
  renderYouthSelector();
  bindNav();
  bindBot();
  // Ouvert depuis une notification (« ?vue=physique ») : on va droit à l'onglet, s'il existe pour ce compte.
  const vue = new URLSearchParams(location.search).get("vue") || "";
  const btnVue = VIEW_TITLES[vue] && document.querySelector(`.pt-nav-item[data-view="${vue}"]`);
  switchView(btnVue && !btnVue.classList.contains("hidden") ? vue : "accueil");

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
const VIEW_TITLES = { accueil: "Accueil", calendrier: "Calendrier", cours: "Mes cours", matchs: "Ma saison", feuille: "Feuille de match", physique: "Physique", comp: "Mental", stages: "Stages", profil: "Profil", contact: "Contact" };
// Joueurs (filières élite) : trop d'onglets pour la barre → Stages, Profil et Contact passent dans « Plus ».
const NAV_OVERFLOW = ["stages", "profil", "contact"];
function arrangeNav() {
  const nav = document.querySelector(".pt-nav"), menu = $("pt-more-menu"), more = $("pt-nav-more");
  const many = PLAYERS.length > 0;
  for (const v of NAV_OVERFLOW) {
    const b = document.querySelector(`.pt-nav-item[data-view="${v}"]`); if (!b) continue;
    if (many) menu.appendChild(b); else nav.insertBefore(b, more);
  }
  more.classList.toggle("hidden", !many);
}
function bindNav() {
  document.querySelectorAll(".pt-nav-item").forEach((b) =>
    b.addEventListener("click", () => switchView(b.dataset.view)));
  $("pt-nav-more").addEventListener("click", (e) => { e.stopPropagation(); $("pt-more-menu").classList.toggle("hidden"); });
  document.addEventListener("click", (e) => { if (!e.target.closest("#pt-more-menu")) $("pt-more-menu").classList.add("hidden"); });
}
function switchView(v) {
  currentView = v;
  $("pt-more-menu").classList.add("hidden");
  document.querySelectorAll(".pt-nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  $("pt-nav-more").classList.toggle("active", !!$("pt-more-menu").querySelector(`[data-view="${v}"]`));
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
  else if (currentView === "feuille") renderFeuille();
  else if (currentView === "physique") renderPhysique();
  else if (currentView === "comp") renderComp();
  else if (currentView === "calendrier") renderCalendrier();
  else if (currentView === "stages") renderStages();
  else if (currentView === "profil") renderProfil();
  else if (currentView === "contact") renderContact();
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
  botBubble("Dans l'onglet <b>Cours</b>, tant que le cours n'a pas commencé, tu es présent par défaut. Si tu es empêché, touche <b>En retard</b> ou <b>Absent</b> et laisse un petit message à ton coach si tu veux ; touche à nouveau le bouton pour annuler. Après le début, c'est la présence notée par ton coach qui s'affiche.");
  botQuick([{ label: "Ouvrir mes cours", run: () => { closeBot(); switchView("cours"); } }, menuBtn]);
}
function qrReserver() {
  botBubble("La réservation des courts se fait sur la grille des courts du site.");
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
      <div><img class="pt-hello-logo" src="assets/logo-academie.webp" alt="Team Lausanne" /></div>
      <div>
        <h2>Bienvenue${who ? " — " + who : ""}&nbsp;!</h2>
        <p class="muted">Les actualités, tes cours et tes infos.</p>
      </div>
    </div>
    ${reseauxHtml()}
    <div id="pt-news"><p class="muted" style="text-align:center;padding:20px">Chargement des news…</p></div>
    <div id="pt-actus"></div>`;
  // Les actualités du site se chargent en parallèle : un message interne lent
  // ne doit pas les retenir, et inversement.
  ptActus();
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
        ${n.body ? `<p>${newsLinks(escHtml(n.body)).replace(/\n/g, "<br/>")}</p>` : ""}
      </div>
    </article>`).join("");
}
// Liens https:// d'un message (texte déjà échappé) → cliquables, ouverts dans un nouvel onglet.
const newsLinks = (html) => html.replace(/https:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" target="_blank" rel="noopener" class="pt-news-link">${u.replace(/^https:\/\/(www\.)?/, "")}</a>`);

/* ---------- Nos réseaux, sous le mot de bienvenue ----------
   Quatre pastilles, pas une liste de liens : sur un téléphone, une icône
   reconnaissable se touche mieux qu'une ligne de texte, et quatre tiennent sur
   une rangée même à 320 px. Chacune s'ouvre dans un nouvel onglet — on ne fait
   pas sortir la famille de l'app sans retour.

   Les adresses vivent dans config.js (RESEAUX) : une entrée vide n'affiche
   rien du tout. C'est ce qui permet de publier le bloc avant que l'adresse
   TikTok ne soit connue, sans laisser une icône qui ne mène nulle part. */
const RESEAUX_DEF = [
  ["instagram", "Instagram", "ig",
    `<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="16.9" cy="7.1" r="1.15" fill="currentColor" stroke="none"/>`],
  // La note TikTok : le crochet part du haut à droite, le corps descend, la
  // tête tourne en bas à gauche. C'est cette silhouette qu'on reconnaît.
  ["tiktok", "TikTok", "tt",
    `<path d="M14.6 3h-2.9v11.6a2.75 2.75 0 1 1-2.1-2.67"/><path d="M14.6 3a5 5 0 0 0 1.85 3.3A5.1 5.1 0 0 0 19.5 7.4"/>`],
  // Le « G » de Google : l'arc ouvert et sa barre. Plus parlant qu'une
  // épingle, même si le lien mène à notre fiche sur la carte.
  ["google", "Google", "gg",
    `<path d="M20 12.2a8 8 0 1 1-2.6-5.9"/><path d="M20 12.2h-7.4"/>`],
  ["site", "Site web", "web",
    `<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.15 2.3 3.35 5.35 3.35 8.5S14.15 18.2 12 20.5c-2.15-2.3-3.35-5.35-3.35-8.5S9.85 5.8 12 3.5z"/>`],
];
function reseauxHtml() {
  const liens = RESEAUX_DEF.filter(([cle]) => (RESEAUX[cle] || "").trim());
  if (!liens.length) return "";
  return `<div class="pt-rx">
    <span class="pt-rx-t">Suivez-nous</span>
    <div class="pt-rx-row">${liens.map(([cle, nom, cls, path]) => `
      <a class="pt-rx-lien ${cls}" href="${escHtml(RESEAUX[cle])}" target="_blank" rel="noopener"
         aria-label="${escHtml(nom)}">
        <span class="pt-rx-pastille"><svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg></span>
        <span class="pt-rx-nom">${escHtml(nom)}</span>
      </a>`).join("")}</div>
  </div>`;
}

/* ============================================================
   LES ACTUALITÉS DU SITE, DANS L'ACCUEIL
   ------------------------------------------------------------
   Les articles de teamlausanne.ch (table news_articles) ne sont pas recopiés
   ici : on les relit. portal_site_news() en rend une poignée SANS le corps
   — la liste reste légère sur un téléphone — avec un drapeau « pour_moi »
   quand la catégorie de l'article est celle de la filière de la famille.
   Pour lire, on redemande l'article seul à news_public(slug), la même
   fonction que le site public.

   L'ORDRE VIENT DE LA BASE, et pas d'ici (db/189) : d'abord sa filière, puis
   ce qui s'en approche (les stages et la GameZone pour les petits, le
   Lausanne Open et les portraits de coachs pour les grands, la vie du club
   pour tout le monde), puis le reste ; passé 90 jours un article perd sa
   priorité pour ne pas camper en tête de liste. Le client n'a donc aucune
   règle de pertinence à connaître : il affiche la liste dans l'ordre reçu.

   Rien n'est filtré : tout ceci est déjà public. On range, on ne cache pas —
   plusieurs filières n'ont pour l'instant aucun article, et une section vide
   serait pire que des nouvelles du club.

   Les images et les liens internes des articles sont écrits pour le site
   (« assets/… », « #stages ») : il faut les rendre absolus, sinon ils
   pointeraient le domaine de l'app, qui ne les sert pas.
   ============================================================ */
const siteUrl = (p) => {
  const s = String(p ?? "").trim();
  if (!s) return "";
  return /^(https?:|data:)/i.test(s) ? s : SITE_PUBLIC + "/" + s.replace(/^\/+/, "");
};
const PT_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function ptActuDate(iso) {
  if (!iso) return "";
  const d = new Date(String(iso).slice(0, 10) + "T12:00:00");
  return `${d.getDate()} ${PT_MOIS[d.getMonth()]}`;
}
let ACTUS = null, ACTUS_CLE = "";   // cache, invalidé quand on change d'enfant

async function ptActus() {
  const box = $("pt-actus"); if (!box) return;
  // Qui regarde : l'enfant choisi, celui de l'aperçu console, ou toute la
  // famille (null) — auquel cas la base prend l'union de ses filières.
  const cible = APERCU || (selYouth !== "all" ? selYouth : null);
  const cle = cible || "famille";
  if (ACTUS === null || ACTUS_CLE !== cle) {
    const { data, error } = await sb.rpc("portal_site_news", { p_youth: cible, p_limit: 5 });
    // Pas de bruit si la fonction manque ou refuse : la section disparaît.
    if (error) { box.innerHTML = ""; return; }
    ACTUS = data || []; ACTUS_CLE = cle;
  }
  if (!ACTUS.length) { box.innerHTML = ""; return; }
  box.innerHTML = `
    <div class="pt-actus-head">
      <h3>Les actualités du club</h3>
      <a href="${SITE_PUBLIC}/actualites" target="_blank" rel="noopener">Toutes ↗</a>
    </div>
    ${ACTUS.map((a) => `
      <article class="pt-actu-card${a.pour_moi ? " mienne" : ""}" data-slug="${escHtml(a.slug)}" tabindex="0" role="button">
        ${a.cover_url ? `<img class="pt-actu-cover" src="${escHtml(siteUrl(a.cover_url))}" alt="${escHtml(a.cover_alt || "")}" loading="lazy" />` : ""}
        <div class="pt-actu-txt">
          <span class="pt-actu-cat">${escHtml(a.category || "")}</span>
          <h4>${escHtml(a.title || "")}</h4>
          ${a.lede ? `<p>${escHtml(a.lede)}</p>` : ""}
          <span class="pt-actu-meta">${escHtml(ptActuDate(a.published_on))}${a.reading_min ? ` · ${a.reading_min} min` : ""}</span>
        </div>
      </article>`).join("")}`;
  box.querySelectorAll(".pt-actu-card").forEach((c) => {
    c.addEventListener("click", () => ptActuOuvrir(c.dataset.slug));
    c.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ptActuOuvrir(c.dataset.slug); }
    });
  });
}

/* Un bloc d'article → du HTML. Le corps n'est pas du HTML en base mais une
   suite de blocs ({t:"p"|"h2"|"quote"|"img"|"lien"}) : rien de ce qui vient de
   la base n'est injecté tel quel, et un type inconnu est ignoré plutôt que de
   casser la page. Même règle que sur le site. */
function ptActuBloc(b) {
  if (!b || typeof b !== "object") return "";
  if (b.t === "p") return `<p>${escHtml(b.x || "")}</p>`;
  if (b.t === "h2") return `<h2>${escHtml(b.x || "")}</h2>`;
  if (b.t === "quote")
    return `<figure class="pt-actu-cite"><p>${escHtml(b.x || "")}</p>${
      b.src ? `<cite>${escHtml(b.src)}</cite>` : ""}</figure>`;
  if (b.t === "img" && b.x)
    return `<figure class="pt-actu-fig"><img src="${escHtml(siteUrl(b.x))}" alt="${escHtml(b.alt || "")}" loading="lazy" />${
      b.cap ? `<figcaption>${escHtml(b.cap)}</figcaption>` : ""}</figure>`;
  if (b.t === "lien" && typeof b.x === "string") {
    // « #stages » désigne une section du SITE : depuis l'app, il faut l'adresse
    // complète. Seuls http(s) et ces ancres sont acceptés — une adresse
    // « javascript: » glissée en base ne doit pas devenir un lien cliquable.
    const u = /^#[\w-]+$/.test(b.x) ? SITE_PUBLIC + "/" + b.x
      : (/^https?:\/\//i.test(b.x) ? b.x : "");
    return u ? `<p><a class="pt-actu-btn" href="${escHtml(u)}" target="_blank" rel="noopener">${
      escHtml(b.label || "Voir")} ↗</a></p>` : "";
  }
  return "";
}

let actuOuverte = false;
async function ptActuOuvrir(slug) {
  const ov = $("pt-actu-read"); if (!ov || !slug) return;
  ov.innerHTML = `<div class="pt-actu-bar"><button type="button" class="pt-actu-retour">← Retour</button></div>
    <div class="pt-actu-corps"><p class="muted" style="padding:20px;text-align:center">Chargement…</p></div>`;
  ov.classList.remove("hidden");
  document.body.classList.add("pt-noscroll");
  if (!actuOuverte) history.pushState({ ptActu: 1 }, "");   // le bouton « retour » du téléphone ferme l'article
  actuOuverte = true;
  ov.querySelector(".pt-actu-retour").addEventListener("click", () => ptActuFermer());
  const { data, error } = await sb.rpc("news_public", { p_slug: slug });
  const a = (data || [])[0];
  const corps = ov.querySelector(".pt-actu-corps"); if (!corps) return;
  if (error || !a) {
    corps.innerHTML = `<p class="muted" style="padding:20px;text-align:center">Article introuvable.
      <a href="${SITE_PUBLIC}/actualites/${encodeURIComponent(slug)}" target="_blank" rel="noopener">Le lire sur le site ↗</a></p>`;
    return;
  }
  const blocs = Array.isArray(a.body) ? a.body : [];
  corps.innerHTML = `
    ${a.cover_url ? `<img class="pt-actu-hero" src="${escHtml(siteUrl(a.cover_url))}" alt="${escHtml(a.cover_alt || "")}" />` : ""}
    <div class="pt-actu-lire">
      <span class="pt-actu-cat">${escHtml(a.category || "")}</span>
      <h1>${escHtml(a.title || "")}</h1>
      <p class="pt-actu-meta">${escHtml(ptActuDate(a.published_on))}${
        a.author ? ` · ${escHtml(a.author)}` : ""}${a.reading_min ? ` · ${a.reading_min} min` : ""}</p>
      ${a.lede ? `<p class="pt-actu-lede">${escHtml(a.lede)}</p>` : ""}
      ${blocs.map(ptActuBloc).join("")}
      <p class="pt-actu-fin"><a href="${SITE_PUBLIC}/actualites/${encodeURIComponent(a.slug)}"
        target="_blank" rel="noopener">Voir sur teamlausanne.ch ↗</a></p>
    </div>`;
  ov.scrollTop = 0;
}
function ptActuFermer(parHistorique) {
  if (!actuOuverte) return;
  actuOuverte = false;
  $("pt-actu-read").classList.add("hidden");
  $("pt-actu-read").innerHTML = "";
  document.body.classList.remove("pt-noscroll");
  // Fermé par le bouton de l'app : on retire aussi l'étape d'historique,
  // sinon le « retour » du téléphone ne ferait plus rien une fois.
  if (!parHistorique && history.state && history.state.ptActu) history.back();
}
window.addEventListener("popstate", () => { if (actuOuverte) ptActuFermer(true); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && actuOuverte) ptActuFermer(); });
// Petite fenêtre de confirmation (message en HTML déjà échappé) → Promise<boolean>.
function ptConfirm(html, okLabel = "Oui") {
  return new Promise((resolve) => {
    const ov = document.createElement("div"); ov.className = "ui-modal";
    ov.innerHTML = `<div class="ui-box pt-notice-box"><p style="margin:0 0 4px;line-height:1.45">${html}</p>
      <div class="ui-actions"><button type="button" class="ghost pt-c-no">Annuler</button><button type="button" class="primary pt-c-ok">${escHtml(okLabel)}</button></div></div>`;
    const done = (v) => { ov.remove(); resolve(v); };
    ov.addEventListener("click", (e) => { if (e.target === ov) done(false); });
    ov.querySelector(".pt-c-no").addEventListener("click", () => done(false));
    ov.querySelector(".pt-c-ok").addEventListener("click", () => done(true));
    document.body.appendChild(ov);
  });
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

  const [cRes, eRes] = await Promise.all([
    sb.rpc("portal_week_courses", { p_from: from, p_to: to }),
    sb.rpc("portal_week_etudes", { p_from: from, p_to: to }),
  ]);
  coursesCache = cRes.error ? [] : (cRes.data || []);
  etudesCache = eRes.error ? [] : (eRes.data || []);
  drawCoursList();
}

function drawCoursList() {
  const list = $("pt-cours-list");
  if (!list) return;
  // Items unifiés : cours + études (13h-17h).
  let items = [
    ...coursesCache.map((c) => ({ type: "cours", youth: c.youth_id, date: c.course_date, time: c.start_time, data: c })),
    ...etudesCache.map((e) => ({ type: "etudes", youth: e.youth_id, date: e.day, time: "13:00", data: e })),
  ];
  if (selYouth !== "all") items = items.filter((it) => it.youth === selYouth);
  if (!items.length) { list.innerHTML = `<div class="pt-empty"><p>Rien de prévu cette semaine.</p></div>`; return; }
  const byDay = {};
  for (const it of items) (byDay[it.date] ||= []).push(it);
  const days = Object.keys(byDay).sort();
  const now = new Date();
  let html = "";
  for (const d of days) {
    const dt = new Date(d + "T00:00:00");
    html += `<div class="pt-day">${DOW[dt.getDay()]} ${frShort(d)}</div>`;
    byDay[d].sort((a, b) => a.time.localeCompare(b.time));
    for (const it of byDay[d]) html += it.type === "etudes" ? etudesCard(it.data) : courseCard(it.data, now);
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
// On indique toujours le prénom de l'enfant quand le compte en a plusieurs (parent).
const showYouthName = () => YOUTHS.length > 1;
const youthChip = (first) => showYouthName() ? `<div class="pt-course-youth">${escHtml(first || "")}</div>` : "";

// Annonces du jeune avant le cours (db/108) : il est présent par défaut ; il peut s'annoncer en retard ou absent,
// avec un message facultatif que les coachs voient dans la console. Recliquer sur l'annonce choisie l'annule.
const NT = {
  retard: { lbl: "En retard", cls: "late" },
  absent: { lbl: "Absent", cls: "no" },
};
function courseCard(c, now) {
  const start = new Date(`${c.course_date}T${c.start_time}:00`);
  const before = now < start;
  let control;
  if (before) {
    const btn = (k) => `<button class="pt-decl ${c.notice_kind === k ? "sel " + NT[k].cls : ""}"
        data-course="${c.course_id}" data-youth="${c.youth_id}" data-status="${k}">${NT[k].lbl}</button>`;
    control = `<div class="pt-decl-row">
        <span class="pt-decl-hint">${c.notice_kind ? "Annoncé :" : "Empêché ?"}</span>
        ${btn("retard")}${btn("absent")}
      </div>
      ${c.notice_kind ? `<div class="pt-decl-note">${c.notice_note ? `Ton message : « ${escHtml(c.notice_note)} » · ` : ""}Touche à nouveau le bouton pour annuler.</div>` : ""}`;
  } else if (c.coach_status) {
    const s = ST[c.coach_status];
    control = `<div class="pt-mark ${s.cls}">Marqué par le coach : <b>${s.lbl}</b></div>`;
  } else if (c.notice_kind) {
    control = `<div class="pt-mark ${NT[c.notice_kind].cls}">Annoncé : <b>${NT[c.notice_kind].lbl}</b></div>`;
  } else {
    control = `<div class="pt-mark wait">Présence pas encore saisie</div>`;
  }
  const meta = [c.court ? `${IC_COURT} ${escHtml(c.court)}` : "", c.coach ? `${IC_COACH} ${escHtml(c.coach)}` : ""].filter(Boolean).join('<span class="pt-meta-sep">·</span>');
  return `<div class="pt-course" style="--c:${c.color || "#1e3ad1"}">
    <div class="pt-course-head">
      <div class="pt-course-time">${c.start_time}<span>${c.end_time}</span></div>
      <div class="pt-course-info">
        ${youthChip(c.youth_first)}
        <div class="pt-course-title">${escHtml(c.title || "Cours")}</div>
        <div class="pt-course-meta">${meta}</div>
      </div>
    </div>
    ${control}
  </div>`;
}

// Carte « Études » (13h-17h) — présence saisie par le prof.
function etudesCard(e) {
  let control;
  if (e.status && ST[e.status]) control = `<div class="pt-mark ${ST[e.status].cls}">Marqué par le prof : <b>${ST[e.status].lbl}</b></div>`;
  else control = `<div class="pt-mark wait">Étude prévue</div>`;
  const meta = e.profs ? `${IC_COACH} ${escHtml(e.profs)}` : "";
  return `<div class="pt-course etudes" style="--c:#7c3aed">
    <div class="pt-course-head">
      <div class="pt-course-time">13:00<span>17:00</span></div>
      <div class="pt-course-info">
        ${youthChip(e.youth_first)}
        <div class="pt-course-title">${IC_STUDY} Études</div>
        <div class="pt-course-meta">${meta}</div>
      </div>
    </div>
    ${control}
  </div>`;
}

async function saveNotice(c, kind, note) {
  const { error } = await sb.rpc("portal_set_notice", { p_course_id: c.course_id, p_youth_id: c.youth_id, p_kind: kind, p_note: note });
  if (error) { alert("Impossible d'enregistrer : " + (error.message || "")); return false; }
  c.notice_kind = kind; c.notice_note = kind ? (note || "").trim().slice(0, 500) || null : null;
  drawCoursList();
  return true;
}
// Clic sur « En retard » / « Absent » : la même annonce déjà posée → on l'annule ; sinon fenêtre avec message facultatif.
function declare(courseId, youthId, kind) {
  const c = coursesCache.find((x) => x.course_id === courseId && x.youth_id === youthId);
  if (!c) return;
  if (c.notice_kind === kind) { saveNotice(c, null, null); return; }
  const who = showYouthName() ? ` (${escHtml(c.youth_first || "")})` : "";
  const ov = document.createElement("div"); ov.className = "ui-modal";
  ov.innerHTML = `<div class="ui-box pt-notice-box">
    <h3 style="margin:0 0 4px">${kind === "absent" ? "Annoncer une absence" : "Annoncer un retard"}${who}</h3>
    <p class="muted" style="margin:0 0 10px;font-size:.86rem">${escHtml(c.title || "Cours")} · ${frShort(c.course_date)} à ${c.start_time}</p>
    <label class="pt-notice-lbl" for="pt-notice-txt">Message pour le coach <span class="muted">(facultatif)</span></label>
    <textarea id="pt-notice-txt" rows="3" maxlength="500" placeholder="${kind === "absent" ? "ex. malade, rendez-vous chez le médecin" : "ex. j'arrive vers 17h15, fin de l'école"}"></textarea>
    <div class="ui-actions"><button type="button" class="ghost pt-notice-no">Annuler</button><button type="button" class="primary pt-notice-ok">${kind === "absent" ? "Je serai absent·e" : "Je serai en retard"}</button></div>
  </div>`;
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.querySelector(".pt-notice-no").addEventListener("click", close);
  ov.querySelector(".pt-notice-ok").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    if (await saveNotice(c, kind, ov.querySelector("#pt-notice-txt").value)) close();
    else e.currentTarget.disabled = false;
  });
  document.body.appendChild(ov);
  ov.querySelector("#pt-notice-txt").focus();
}

/* ============================================================
   CALENDRIER DE LA SAISON
   ------------------------------------------------------------
   Remplace l'onglet « Réserver » (20.10.2026). Les deux calendriers PDF du
   site — école de tennis et sport-études — deviennent ici une grille qu'on
   parcourt du pouce : un mois à la fois, les périodes en BARRES continues en
   travers de la semaine (« Vacances d'automne » se lit d'un bout à l'autre,
   sans un clic), et le détail d'un jour sous la grille.

   Les dates ne sont pas recopiées : elles viennent d'agenda_public(), la même
   fonction que le site public — vacances scolaires vaudoises, jours fériés,
   fermetures du club, stages, événements. Le PDF reste téléchargeable pour
   qui veut l'imprimer et l'afficher sur le frigo.

   Le programme affiché suit la filière du jeune (portal_mes_filieres, db/190) :
   école de tennis pour kids tennis, club, compétition, performance et adultes ;
   sport-études pour les sport-études ; les pros ont pour l'instant l'agenda du
   club, leur calendrier propre restant à définir. Une famille à cheval sur
   deux programmes reçoit un sélecteur.
   ============================================================ */
const CAL_PROGRAMMES = {
  ecole: {
    titre: "École de tennis",
    sous: "Kids Tennis · Club · Compétition · Performance · Adultes",
    pdf: "assets/calendriers/calendrier-2026-27-ecole-de-tennis.pdf",
  },
  "sport-etudes": {
    titre: "Sport-Études",
    sous: "Tennis · préparation physique · encadrement scolaire",
    pdf: "assets/calendriers/calendrier-2026-27-sport-etudes.pdf",
  },
  // Les pros n'ont pas de calendrier scolaire : leur saison suit les tournois.
  // En attendant leur propre mise en page, ils voient l'agenda du club, qui
  // leur sert quand même (fermetures, Lausanne Open, stages).
  pro: {
    titre: "Agenda du club",
    sous: "Fermetures, stages et rendez-vous — calendrier pro à venir",
    pdf: null,
  },
};
const CAL_DE_FILIERE = {
  kidstennis: "ecole", club: "ecole", competition: "ecole", performance: "ecole",
  adultes: "ecole", prive: "ecole", membre: "ecole",
  "sport-etudes": "sport-etudes", pro: "pro", "pro-u18": "pro",
};
// L'ordre range les pastilles de la légende ET départage deux entrées qui
// tombent le même jour : ce qui demande une action passe avant le décor.
const CAL_GENRES = [
  ["fermeture", "Club fermé"],
  ["stage", "Stages"],
  ["evenement", "Événements"],
  ["vacances-scolaires", "Vacances (pas de cours)"],
  ["ferie", "Jours fériés"],
];
const CAL_MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// Dates manipulées en texte « AAAA-MM-JJ » et jamais en objet Date : une borne
// de vacances comparée en UTC se décale d'un jour vue depuis Lausanne.
const calISO = (a, m, j) => `${a}-${String(m + 1).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
const calAuj = () => { const d = new Date(); return calISO(d.getFullYear(), d.getMonth(), d.getDate()); };
const calNbJours = (a, m) => new Date(a, m + 1, 0).getDate();
const calPremiereCase = (a, m) => (new Date(a, m, 1).getDay() + 6) % 7;   // lundi = 0
const calDecaler = (ym, n) => {
  const [a, m] = ym.split("-").map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const calFr = (iso) => { const [a, m, j] = iso.split("-").map(Number); return `${j} ${CAL_MOIS_FR[m - 1]} ${a}`; };
const calCourt = (iso) => { const [, m, j] = iso.split("-").map(Number); return `${j} ${CAL_MOIS_FR[m - 1].slice(0, 4)}.`; };
// « Du 5 au 11 octobre 2026 » plutôt que de répéter le mois des deux côtés.
const calPeriode = (d, f) => {
  if (d === f) return calFr(d);
  const [a1, m1, j1] = d.split("-").map(Number);
  const [a2, m2] = f.split("-").map(Number);
  if (a1 === a2 && m1 === m2) return `Du ${j1} au ${calFr(f)}`;
  if (a1 === a2) return `Du ${j1} ${CAL_MOIS_FR[m1 - 1]} au ${calFr(f)}`;
  return `Du ${calFr(d)} au ${calFr(f)}`;
};

let CAL_DATES = null, CAL_PROG = null, CAL_PROGS = [], CAL_MOIS = null, CAL_JOUR = null, CAL_CLE = "";

// Trois sources décrivent souvent le même jour : le canton le dit férié,
// l'école le met en vacances, et nous fermons. On regroupe ce qui couvre
// exactement la même période en UNE entrée, qui garde le genre le plus
// actionnable et porte les autres titres en mention.
function calFusion(rows) {
  const rang = (g) => { const i = CAL_GENRES.findIndex(([k]) => k === g); return i < 0 ? 99 : i; };
  const par = new Map();
  for (const e of rows || []) {
    const cle = e.debut + "|" + e.fin;
    if (!par.has(cle)) par.set(cle, []);
    par.get(cle).push(e);
  }
  const out = [];
  for (const lot of par.values()) {
    lot.sort((a, b) => rang(a.genre) - rang(b.genre));
    const chef = lot[0];
    const genres = [...new Set(lot.map((e) => e.genre))];
    const titres = [...new Set(lot.map((e) => e.titre).filter(Boolean))];
    out.push({ debut: chef.debut, fin: chef.fin, titre: chef.titre, genre: chef.genre,
      genres, autres: titres.slice(1), detail: chef.detail || "" });
  }
  return out.sort((a, b) => a.debut.localeCompare(b.debut) || rang(a.genre) - rang(b.genre));
}
const calDuJour = (iso) => {
  const rang = (g) => CAL_GENRES.findIndex(([k]) => k === g);
  return (CAL_DATES || []).filter((e) => e.debut <= iso && iso <= e.fin)
    .sort((a, b) => rang(a.genre) - rang(b.genre));
};

async function renderCalendrier() {
  const vue = $("view-calendrier"); if (!vue) return;
  const cible = APERCU || (selYouth !== "all" ? selYouth : null);
  const cle = cible || "famille";
  if (!CAL_PROGS.length || CAL_CLE !== cle) {
    vue.innerHTML = `<p class="muted" style="text-align:center;padding:24px">Chargement du calendrier…</p>`;
    const { data } = await sb.rpc("portal_mes_filieres", { p_youth: cible });
    // Sans filière connue (un parent dont l'enfant n'est pas inscrit cette
    // saison), on montre l'école de tennis : le calendrier du plus grand nombre.
    const progs = [...new Set((data || []).map((r) => CAL_DE_FILIERE[r.filiere]).filter(Boolean))];
    CAL_PROGS = progs.length ? progs : ["ecole"];
    // L'agenda dépend de l'enfant regardé : il porte les événements qui visent
    // SA filière. Changer d'enfant doit donc le relire, pas réutiliser l'autre.
    if (CAL_CLE !== cle) CAL_DATES = null;
    CAL_CLE = cle;
    if (!CAL_PROGS.includes(CAL_PROG)) CAL_PROG = CAL_PROGS[0];
  }
  if (!CAL_DATES) {
    // Une fenêtre d'un an à partir du mois en cours : assez pour toute la
    // saison. agenda_famille() rend le calendrier public PLUS les événements
    // qui visent une filière de la famille (db/191) — « Activité joueurs de
    // l'academy » n'apparaît que chez les sport-études.
    const d = new Date();
    const du = calISO(d.getFullYear(), d.getMonth(), 1);
    const au = calISO(d.getFullYear() + 1, d.getMonth(), calNbJours(d.getFullYear() + 1, d.getMonth()));
    const { data, error } = await sb.rpc("agenda_famille", { p_du: du, p_au: au, p_youth: cible });
    if (error) {
      vue.innerHTML = `<div class="pt-panel"><p class="muted">Le calendrier n'a pas pu être chargé. Réessaie plus tard.</p></div>`;
      return;
    }
    CAL_DATES = calFusion(data);
  }
  if (!CAL_MOIS) CAL_MOIS = calAuj().slice(0, 7);
  calDessiner();
}

function calDessiner() {
  const vue = $("view-calendrier"); if (!vue) return;
  const p = CAL_PROGRAMMES[CAL_PROG] || CAL_PROGRAMMES.ecole;
  const auj = calAuj();
  const horsSaison = auj < SAISON_COURS.reprise || auj > SAISON_COURS.fin;
  vue.innerHTML = `
    ${CAL_PROGS.length > 1 ? `<div class="pcal-progs">${CAL_PROGS.map((k) =>
      `<button type="button" class="pcal-prog${k === CAL_PROG ? " on" : ""}" data-pcal-prog="${k}">${
        escHtml(CAL_PROGRAMMES[k].titre)}</button>`).join("")}</div>` : ""}
    <div class="pcal-tete">
      <span class="pcal-eyebrow">Saison ${escHtml(SAISON_COURS.label)}</span>
      <h2>${escHtml(p.titre)}</h2>
      <p class="pcal-sous">${escHtml(p.sous)}</p>
      <div class="pcal-stats">
        <div><span>Reprise</span><b>${escHtml(calCourt(SAISON_COURS.reprise))}</b></div>
        <div><span>Fin de saison</span><b>${escHtml(calCourt(SAISON_COURS.fin))}</b></div>
        <div><span>Durée</span><b>${SAISON_COURS.semaines} sem.</b></div>
      </div>
      ${p.pdf ? `<a class="pcal-pdf" href="${SITE_PUBLIC}/${p.pdf}" target="_blank" rel="noopener">⤓ Le calendrier en PDF</a>` : ""}
      ${horsSaison ? `<p class="pcal-hors">La saison ${escHtml(SAISON_COURS.label)} ${
        auj < SAISON_COURS.reprise ? "n'a pas encore commencé" : "est terminée"}.</p>` : ""}
    </div>
    <div id="pcal-grille"></div>
    <div id="pcal-jour" class="pcal-jour hidden"></div>
    <div id="pcal-suite"></div>`;
  calGrille();
  calSuite();
  vue.querySelectorAll("[data-pcal-prog]").forEach((b) =>
    b.addEventListener("click", () => { CAL_PROG = b.dataset.pcalProg; CAL_JOUR = null; calDessiner(); }));
}

function calGrille() {
  const box = $("pcal-grille"); if (!box) return;
  const [a, m] = CAL_MOIS.split("-").map(Number);
  const an = a, mois = m - 1, auj = calAuj();
  const nb = calNbJours(an, mois), avant = calPremiereCase(an, mois);

  // On complète le début et la fin avec les jours des mois voisins : une
  // grille trouée se lit mal, et une période à cheval sur deux mois doit
  // pouvoir continuer jusqu'au bord.
  const cases = [];
  for (let i = avant; i > 0; i--) {
    const d = new Date(an, mois, 1 - i);
    cases.push({ iso: calISO(d.getFullYear(), d.getMonth(), d.getDate()), j: d.getDate(), hors: true });
  }
  for (let j = 1; j <= nb; j++) cases.push({ iso: calISO(an, mois, j), j, hors: false });
  while (cases.length % 7) {
    const d = new Date(an, mois, nb + (cases.length - avant - nb) + 1);
    cases.push({ iso: calISO(d.getFullYear(), d.getMonth(), d.getDate()), j: d.getDate(), hors: true });
  }
  const semaines = [];
  for (let i = 0; i < cases.length; i += 7) semaines.push(cases.slice(i, i + 7));

  const JOURS = ["L", "M", "M", "J", "V", "S", "D"];
  const dates = CAL_DATES || [];
  const presents = CAL_GENRES.filter(([g]) => dates.some((e) =>
    e.genres.includes(g) && e.fin >= cases[0].iso && e.debut <= cases[cases.length - 1].iso));

  box.innerHTML = `
    <div class="pcal-barre">
      <button type="button" class="pcal-nav" data-pcal-mois="-1" aria-label="Mois précédent">‹</button>
      <strong aria-live="polite">${CAL_MOIS_FR[mois]} ${an}</strong>
      <button type="button" class="pcal-nav" data-pcal-mois="1" aria-label="Mois suivant">›</button>
      ${CAL_MOIS === auj.slice(0, 7) ? "" : `<button type="button" class="pcal-auj-btn" data-pcal-auj>Aujourd'hui</button>`}
    </div>
    <div class="pcal-dows" aria-hidden="true">${JOURS.map((j) => `<span>${j}</span>`).join("")}</div>
    <div class="pcal-sem-liste">${semaines.map((sem) => {
      const d0 = sem[0].iso, d6 = sem[6].iso;
      // Les périodes qui touchent cette semaine, les plus longues d'abord :
      // une barre qui traverse toute la semaine se lit mieux en haut.
      const barres = dates.filter((e) => e.debut <= d6 && e.fin >= d0).map((e) => {
        let d = 0; while (d < 6 && sem[d].iso < e.debut) d++;
        let f = 6; while (f > 0 && sem[f].iso > e.fin) f--;
        return { e, col: d + 1, span: Math.max(1, f - d + 1), coupeG: e.debut < d0, coupeD: e.fin > d6 };
      }).sort((x, y) => y.span - x.span || x.col - y.col);
      // Couloirs : chaque barre se pose sur la première ligne libre, donc deux
      // périodes qui se chevauchent s'empilent au lieu de se recouvrir.
      const couloirs = [];
      for (const b of barres) {
        let k = 0;
        while (couloirs[k] && couloirs[k].some((o) => b.col < o.col + o.span && o.col < b.col + b.span)) k++;
        (couloirs[k] = couloirs[k] || []).push(b);
        b.lane = k;
      }
      return `<div class="pcal-sem">
        ${sem.map((c, i) => `<button type="button" class="pcal-j${c.hors ? " hors" : ""}${
          c.iso === auj ? " auj" : ""}${c.iso === CAL_JOUR ? " sel" : ""}"
          style="grid-column:${i + 1}" data-pcal-jour="${c.iso}"
          aria-label="${escHtml(calFr(c.iso))}">${c.j}</button>`).join("")}
        ${barres.map((b) => `<button type="button" class="pcal-bar g-${b.e.genre}${
          b.coupeG ? " coupe-g" : ""}${b.coupeD ? " coupe-d" : ""}"
          style="grid-column:${b.col} / span ${b.span};grid-row:${b.lane + 2}"
          data-pcal-jour="${b.e.debut < d0 ? d0 : b.e.debut}"
          title="${escHtml(b.e.titre)}">${
          // Une barre d'un seul jour fait 44 px : le titre y tiendrait en
          // trois lettres suivies de points. On laisse la couleur parler,
          // le détail du jour dit le reste.
          b.span > 1 ? `<span>${escHtml(b.e.titre)}</span>` : ""}</button>`).join("")}
      </div>`;
    }).join("")}</div>
    ${presents.length ? `<ul class="pcal-legende">${presents.map(([g, lbl]) =>
      `<li class="g-${g}"><i aria-hidden="true"></i>${escHtml(lbl)}</li>`).join("")}</ul>` : ""}`;

  box.querySelectorAll("[data-pcal-mois]").forEach((b) => b.addEventListener("click", () => {
    CAL_MOIS = calDecaler(CAL_MOIS, Number(b.dataset.pcalMois)); CAL_JOUR = null; calGrille();
  }));
  const btnAuj = box.querySelector("[data-pcal-auj]");
  if (btnAuj) btnAuj.addEventListener("click", () => {
    CAL_MOIS = calAuj().slice(0, 7); CAL_JOUR = null; calGrille();
  });
  box.querySelectorAll("[data-pcal-jour]").forEach((b) => b.addEventListener("click", () => {
    const iso = b.dataset.pcalJour;
    CAL_JOUR = CAL_JOUR === iso ? null : iso;
    // Toucher un jour d'un mois voisin ouvre ce mois : sinon le détail
    // parlerait d'une date qu'on ne voit plus.
    if (CAL_JOUR && CAL_JOUR.slice(0, 7) !== CAL_MOIS) CAL_MOIS = CAL_JOUR.slice(0, 7);
    calGrille();
  }));
  calJour();
}

// Le détail du jour choisi, sous la grille : on touche pour en savoir PLUS,
// pas pour découvrir qu'il se passe quelque chose — les barres le disent déjà.
function calJour() {
  const box = $("pcal-jour"); if (!box) return;
  const lot = CAL_JOUR ? calDuJour(CAL_JOUR) : [];
  if (!lot.length) { box.innerHTML = ""; box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  box.innerHTML = `<div class="pcal-jour-t"><b>${escHtml(calFr(CAL_JOUR))}</b>
      <button type="button" class="pcal-fermer" data-pcal-fermer aria-label="Fermer">×</button></div>
    <ul class="pcal-items">${lot.map((e) => `<li class="g-${e.genre}">
      <span class="pcal-quand">${escHtml(calPeriode(e.debut, e.fin))}</span>
      <b>${escHtml(e.titre)}</b>
      ${e.autres.length ? `<span class="pcal-aussi">${escHtml(e.autres.join(" · "))}</span>` : ""}
      ${e.detail ? `<span class="pcal-detail">${escHtml(e.detail)}</span>` : ""}</li>`).join("")}</ul>`;
  box.querySelector("[data-pcal-fermer]").addEventListener("click", () => { CAL_JOUR = null; calGrille(); });
}

// Ce qui reste devant nous. Une période commencée mais pas finie compte comme
// à venir : les vacances d'automne intéressent autant le 15 octobre que le 1er.
function calSuite() {
  const box = $("pcal-suite"); if (!box) return;
  const auj = calAuj();
  const suite = (CAL_DATES || []).filter((e) => e.fin >= auj).slice(0, 5);
  if (!suite.length) { box.innerHTML = ""; return; }
  box.innerHTML = `<h3 class="pcal-suite-t">Prochaines dates</h3>
    <ul class="pcal-items pcal-suite">${suite.map((e) => `<li class="g-${e.genre}">
      <span class="pcal-quand">${escHtml(calPeriode(e.debut, e.fin))}</span>
      <b>${escHtml(e.titre)}</b>
      ${e.detail ? `<span class="pcal-detail">${escHtml(e.detail)}</span>` : ""}</li>`).join("")}</ul>`;
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
  if (error) {
    // 23505 = l'index unique stage_registrations_pas_deux_fois (db/142). Un
    // parent doit lire une phrase, pas le jargon de Postgres.
    err.textContent = error.code === "23505"
      ? "Cet enfant est déjà inscrit à ce stage dans cette catégorie. Si c'est une erreur, écrivez-nous à info@teamlausanne.ch."
      : "Erreur : " + error.message;
    err.hidden = false; btn.disabled = false; btn.textContent = "Envoyer mon inscription"; return;
  }
  $("stg-form").classList.add("hidden"); $("stg-done").classList.remove("hidden");
  $("stg-meta").textContent = "";
}

/* ============================================================
   PROFIL (mental/études publics — à venir)
   ============================================================ */
const PROF_FIELDS = [
  { k: "email", lbl: "Email", type: "email" },
  { k: "phone", lbl: "Téléphone", type: "tel" },
  { k: "birthdate", lbl: "Date de naissance", type: "date" },
  { k: "gender", lbl: "Genre", type: "gender" },
  { k: "avs", lbl: "N° AVS", type: "text" },
  { k: "license_no", lbl: "N° licence Swiss Tennis", type: "text" },
  { k: "address", lbl: "Adresse", type: "text" },
  { k: "postal_code", lbl: "NPA", type: "text" },
  { k: "city", lbl: "Ville", type: "text" },
];
const SECRETARIAT_TEL = "+41 21 646 13 50";
const genderLabel = (g) => g === "F" ? "Fille" : g === "M" ? "Garçon" : "";
const isoToFr = (iso) => { const s = (iso || "").slice(0, 10).split("-"); return s.length === 3 ? `${s[2]}.${s[1]}.${s[0]}` : ""; };
const secretariatNote = `<p class="pt-prof-note">🔒 Ces informations sont verrouillées. Pour tout changement, merci de contacter le secrétariat : <a href="tel:+41216461350">${SECRETARIAT_TEL}</a> ou via le <a href="contact.html">formulaire de contact</a>.</p>`;

async function renderProfil() {
  const targets = selYouth === "all" ? YOUTHS : YOUTHS.filter((y) => y.person_id === selYouth);
  // Pied de l'onglet, présent dans tous les cas : la suppression du compte doit toujours être accessible depuis l'app.
  const foot = `<p style="margin:22px 4px 8px;font-size:.84rem;text-align:center"><a href="confidentialite.html" target="_blank" rel="noopener" class="muted">Confidentialité</a> · <a href="#" id="pt-delete-account" style="color:#b3261e">Supprimer mon compte</a></p>`;
  const bindFoot = () => document.getElementById("pt-delete-account").addEventListener("click", (e) => { e.preventDefault(); openDeleteAccount(); });
  if (!targets.length) { $("view-profil").innerHTML = `<div class="pt-empty"><p>Aucun profil lié à ce compte.</p></div>` + foot; bindFoot(); return; }
  $("view-profil").innerHTML = `<p class="muted" style="text-align:center;padding:18px">Chargement…</p>`;
  const infos = await Promise.all(targets.map(async (y) => {
    const { data } = await sb.rpc("portal_youth_info", { p_youth: y.person_id });
    return { y, info: (data && data[0]) || null };
  }));
  $("view-profil").innerHTML = infos.map(({ y, info }) => youthProfileCard(y, info)).join("") + foot;
  bindFoot();
  infos.forEach(({ y }) => {
    const btn = document.getElementById("prof-save-" + y.person_id);
    if (btn) btn.addEventListener("click", () => saveYouthProfile(y.person_id));
  });
}

function youthProfileCard(y, info) {
  const editable = info && !info.confirmed;
  const rows = PROF_FIELDS.map((f) => {
    const val = info ? info[f.k] : "";
    if (editable && !val) {
      if (f.type === "gender")
        return `<div class="pt-prof-row edit"><span>${f.lbl}</span><select id="pf-${y.person_id}-gender"><option value="">—</option><option value="M">Garçon</option><option value="F">Fille</option></select></div>`;
      return `<div class="pt-prof-row edit"><span>${f.lbl}</span><input id="pf-${y.person_id}-${f.k}" type="${f.type}" placeholder="À compléter" /></div>`;
    }
    if (!val) return "";
    const disp = f.k === "birthdate" ? isoToFr(val) : f.k === "gender" ? genderLabel(val) : val;
    return `<div class="pt-prof-row"><span>${f.lbl}</span><b>${escHtml(disp)}</b></div>`;
  }).join("");
  const foot = editable
    ? `<p class="muted" style="font-size:.82rem;margin:10px 0">Complète les infos manquantes puis valide (une seule fois). Ensuite, contacte le secrétariat pour tout changement.</p>
       <button type="button" id="prof-save-${y.person_id}" class="pt-prof-save">Valider mes informations</button>
       <span id="prof-status-${y.person_id}" class="muted" style="margin-left:10px;font-size:.85rem"></span>`
    : secretariatNote;
  return `<div class="pt-prof">
    <div class="pt-prof-head">
      <div class="pt-youth-av big">${initials(y.first_name, y.last_name).toUpperCase()}</div>
      <div><b>${escHtml(y.first_name)} ${escHtml(y.last_name)}</b></div>
    </div>
    <div class="pt-prof-grid">${rows || '<p class="muted" style="font-size:.85rem">Aucune information enregistrée.</p>'}</div>
    ${foot}
  </div>`;
}

async function saveYouthProfile(youthId) {
  const payload = {};
  PROF_FIELDS.forEach((f) => { const el = document.getElementById("pf-" + youthId + "-" + f.k); if (el) payload[f.k] = el.value.trim(); });
  const st = document.getElementById("prof-status-" + youthId);
  if (st) st.textContent = "Validation…";
  const { error } = await sb.rpc("portal_confirm_profile", { p_youth: youthId, p_data: payload });
  if (error) { if (st) st.textContent = "Erreur : " + error.message; return; }
  renderProfil();
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
// Feuille du jeune en deux temps (db/109) : textes AVANT le match, puis APRÈS.
const MR_PRE_KEYS = ["strategy_pre", "opp_sw", "opp_style"];
const MR_POST_KEYS = ["how_won", "how_lost", "did_well", "to_improve", "three_positives"];
function mrpLabels(role, gender) {
  const il = gender === "F" ? "elle" : "il";
  const base = {
    strategy_pre: "Stratégie d'avant match", opp_sw: "Forces et faiblesses de l'adversaire",
    opp_style: "Style de jeu de l'adversaire", three_positives: "3 choses positives de ce match",
  };
  if (role === "joueur") return {
    ...base, strategy_pre: "Ma stratégie pour ce match",
    how_won: "Comment j'ai gagné la majorité des points", how_lost: "Comment j'ai perdu la majorité des points",
    did_well: "Ce que j'ai bien réussi à faire, ce dont je suis satisfait·e", to_improve: "Ce que je dois améliorer, ce qui pourrait être mieux",
  };
  return {
    ...base, how_won: `Comment ${il} a gagné la majorité des points`, how_lost: `Comment ${il} a perdu la majorité des points`,
    did_well: `Ce qu'${il} a bien réussi à faire`, to_improve: `Ce qu'${il} doit améliorer`,
  };
}
// Questions de préparation / d'analyse mentale (ex-formulaire « Compétition » du Mental), ramenées au match.
const MF_PREP = [
  ["horaires", "Horaires et routines de préparation", "Réveil, repas, échauffement, trajet…"],
  ["specifique", "Qu'est-ce qui est spécifique à ce match ou à ce tournoi ? Qu'est-ce qui peut être différent ?", "L'horaire, l'entourage, le bruit, l'enchaînement des matchs…"],
  ["represente", "Qu'est-ce que ce match représente pour moi ?", ""],
  ["objectifs", "Quels sont mes objectifs ?", ""],
  ["tester", "Qu'est-ce que je vais tester de nouveau ?", "Un autre échauffement, un mindset… ou rien"],
  ["sentir", "Comment je veux me sentir pendant le match ?", "Confiant·e, puissant·e…"],
];
const MF_ANALYSE = [
  ["highlight", "Mon highlight du match", ""],
  ["avant", "Comment je me suis senti·e AVANT le match ?", ""],
  ["pendant", "Comment je me suis senti·e PENDANT le match ?", ""],
  ["apres", "Comment je me suis senti·e APRÈS le match ?", ""],
  ["different", "Qu'est-ce qui était différent de ce que j'avais pensé ?", ""],
  ["retour_coach", "Quel est le retour de mon entraîneur ?", ""],
  ["appris", "Qu'est-ce que j'ai appris pendant ce match ?", ""],
];

// Sélecteur de joueur (parent avec plusieurs enfants joueurs) + choix par défaut.
const playerPick = (cur) => (cur && PLAYERS.some((p) => p.person_id === cur)) ? cur
  : (selYouth !== "all" && PLAYERS.some((p) => p.person_id === selYouth)) ? selYouth : PLAYERS[0].person_id;
const playerSelHtml = (cur) => PLAYERS.length > 1
  ? `<div class="mrp-players">${PLAYERS.map((p) => `<button class="mrp-player ${p.person_id === cur ? "sel" : ""}" data-id="${p.person_id}">${escHtml(p.first_name)}</button>`).join("")}</div>` : "";

// ---------- Onglet « Saison » : la frise de saison seule (la feuille de match a son propre onglet) ----------
let mrpSel = null;
function renderMatchs() {
  const host = $("view-matchs");
  if (!PLAYERS.length) { host.innerHTML = `<div class="pt-empty"><p>La saison est réservée aux joueurs de compétition.</p></div>`; return; }
  mrpSel = playerPick(mrpSel);
  const player = PLAYERS.find((p) => p.person_id === mrpSel);
  host.innerHTML = `${playerSelHtml(mrpSel)}<div id="mrp-season"><p class="muted" style="text-align:center;padding:12px">Chargement…</p></div>`;
  host.querySelectorAll(".mrp-player").forEach((b) => b.addEventListener("click", () => { mrpSel = b.dataset.id; renderMatchs(); }));
  renderPortalSeason(player);
}

/* ---------- Ma saison (db/106) ----------
   La frise montre la PLANIFICATION des coachs (zone de chaque semaine + week-ends de tournoi prévus) et, en dessous,
   MES INSCRIPTIONS (dates libres, elles peuvent déborder du week-end ou se chevaucher). Une inscription hors d'une zone
   tournoi prévue est marquée en rouge ; elle ne change jamais la planification. Toucher une semaine = son détail.
   Le jeune (ou son parent) ajoute et retire ses propres inscriptions, pas celles saisies par les coachs. */
const PS_KINDS = { prepa: "Prépa physique", entrainement: "Entraînement", option: "Entraînement en option", vacances: "Vacances", etranger: "Tournoi à l'étranger" };
const PS_MONTHS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
const psDay = (iso, n) => addDays(new Date(iso + "T12:00:00"), n);
const psD = (iso) => { const d = new Date(iso + "T12:00:00"); return `${d.getDate()} ${PS_MONTHS[d.getMonth()]}`; };
const psRange = (a, b) => (a === b ? psD(a) : `${psD(a)} – ${psD(b)}`);
const psWe = (ws) => psRange(isoLocal(psDay(ws, 5)), isoLocal(psDay(ws, 6)));
async function renderPortalSeason(player) {
  const host = $("mrp-season"); if (!host) return;
  const today = isoLocal(new Date());
  const { data: seasons } = await sb.from("plan_seasons").select("*").order("start_monday", { ascending: false });
  const s = (seasons || []).find((x) => x.start_monday <= today && isoLocal(psDay(x.start_monday, x.weeks * 7 - 1)) >= today) || (seasons || [])[0];
  if (!s) { host.innerHTML = ""; return; }
  const weeks = []; for (let i = 0; i < s.weeks; i++) weeks.push(isoLocal(psDay(s.start_monday, 7 * i)));
  const a = weeks[0], z = isoLocal(psDay(weeks[weeks.length - 1], 6));
  const [{ data: w }, { data: t }, { data: offRows }, { data: u }] = await Promise.all([
    sb.from("plan_weeks").select("week_start,kind").eq("person_id", player.person_id).gte("week_start", a).lte("week_start", z),
    sb.from("plan_tournaments").select("id,week_start,start_date,end_date,name,source,created_by").eq("person_id", player.person_id).gte("week_start", isoLocal(psDay(a, -49))).lte("week_start", z).order("start_date"),
    sb.from("plan_days_off").select("day,label").gte("day", a).lte("day", z).order("day"),
    sb.auth.getUser(),
  ]);
  if ($("mrp-season") !== host) return;   // l'onglet a été redessiné entre-temps
  const kinds = {}; for (const r of w || []) kinds[r.week_start] = r.kind;
  // Jours fériés / sans entraînement (db/110) de la semaine.
  const PS_DOW = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
  const offIn = (ws) => { const we = isoLocal(psDay(ws, 6)); return (offRows || []).filter((d) => d.day >= ws && d.day <= we); };
  const all = t || [], me = u?.user?.id;
  const planned = (ws) => all.filter((x) => x.source === "staff" && x.week_start === ws);
  const regsIn = (ws) => { const we = isoLocal(psDay(ws, 6)); return all.filter((x) => x.source === "joueur" && x.start_date <= we && x.end_date >= ws); };
  const covered = (ws) => planned(ws).length > 0 || kinds[ws] === "etranger";
  // Inscription hors planification = aucune des semaines qu'elle touche n'a de tournoi prévu (ni semaine à l'étranger).
  const regHors = (x) => !weeks.filter((ws) => ws <= x.end_date && isoLocal(psDay(ws, 6)) >= x.start_date).some(covered);
  const thisMonday = isoLocal(psDay(today, -((new Date().getDay() + 6) % 7)));
  let months = "", prev = -1, start = 1;
  weeks.forEach((ws, i) => { const m = psDay(ws, 3).getMonth(); if (m !== prev) { if (prev !== -1) months += `<span style="grid-column:${start}/${i + 1}">${PS_MONTHS[prev]}</span>`; prev = m; start = i + 1; } });
  months += `<span style="grid-column:${start}/${weeks.length + 1}">${PS_MONTHS[prev]}</span>`;
  // Téléphone : mosaïque (une ligne par mois, tuiles larges et faciles à toucher) ; ordinateur : frise sur une ligne.
  const mosaic = window.matchMedia("(max-width: 1024px), (pointer: coarse)").matches;   // téléphone et tablette
  const cellArr = weeks.map((ws, i) => {
    const k = kinds[ws] || "", pl = planned(ws), rg = regsIn(ws), hors = rg.some(regHors);
    return `<div class="pl-col ps-col${ws === thisMonday ? " pl-now" : ""}" data-i="${i}"><div class="pl-top pl-k-${k || "none"}${offIn(ws).length ? " pl-off" : ""}">${mosaic ? `<span class="pl-day">${psDay(ws, 0).getDate()}</span>` : ""}</div><div class="pl-we${pl.length ? " pl-we-on" : ""}"></div><div class="pl-reg${rg.length ? (hors ? " pl-reg-hors" : " pl-reg-on") : ""}"></div></div>`;
  });
  const rowsM = [];
  weeks.forEach((ws, i) => { const m = psDay(ws, 3).getMonth(); const last = rowsM[rowsM.length - 1]; if (last && last.m === m) last.idx.push(i); else rowsM.push({ m, idx: [i] }); });
  const friseHtml = mosaic
    ? `<div class="pl-frise pl-mosaic ps-frise">${rowsM.map((r) => `<div class="pl-mrow"><span class="pl-mlab">${PS_MONTHS[r.m]}</span><div class="pl-mcells">${r.idx.map((i) => cellArr[i]).join("")}</div></div>`).join("")}</div>`
    : `<div class="pl-months" style="grid-template-columns:repeat(${weeks.length},minmax(0,1fr))">${months}</div>
    <div class="pl-frise ps-frise" style="grid-template-columns:repeat(${weeks.length},minmax(0,1fr))">${cellArr.join("")}</div>`;
  const mine = all.filter((x) => x.source === "joueur" && x.end_date >= today);
  // Week-ends en zone tournoi, à venir, sans aucune inscription cette semaine-là.
  const todo = weeks.filter((ws) => isoLocal(psDay(ws, 6)) >= today && planned(ws).length && !regsIn(ws).length);
  // Mode d'emploi de la frise (28.09.2026) : une case expliquée étage par étage, repliable (choix mémorisé).
  let guideClosed = false; try { guideClosed = localStorage.getItem("ps-guide-closed") === "1"; } catch { /* stockage indisponible */ }
  const kindsChips = Object.entries(PS_KINDS).map(([k, l]) => `<span class="ps-g-chip"><i class="pl-k-${k}"></i>${l}</span>`).join("")
    + '<span class="ps-g-chip"><i class="pl-k-none"></i>Rien de prévu</span>';
  const guide = `<details class="ps-guide"${guideClosed ? "" : " open"}>
    <summary><span>Comment lire ma saison&nbsp;?</span><span class="ps-g-tog"></span></summary>
    <p class="ps-g-intro">Chaque case est <b>une semaine</b> (le chiffre = la date du lundi). Elle se lit de haut en bas :</p>
    <div class="ps-g-body">
      <div class="ps-g-tile" aria-hidden="true"><div class="t pl-k-entrainement pl-off">7</div><i>1</i><div class="w pl-we-on"></div><i>2</i><div class="r pl-reg-on"></div><i>3</i></div>
      <ol class="ps-g-steps">
        <li><b>Le grand carré : ton programme de la semaine</b>, prévu par tes coachs. Sa couleur :
          <div class="ps-g-chips">${kindsChips}</div>
          <span class="ps-g-note">Un <b>petit coin noir</b> en haut à droite = un jour férié ou sans entraînement cette semaine-là.</span></li>
        <li><b>La barre orange : zone tournoi.</b> Tes coachs veulent que tu joues un tournoi ce week-end. À toi de t'inscrire à un tournoi, puis de l'ajouter en bas de cette page.</li>
        <li><b>La barre du bas : tes inscriptions.</b> <span class="ps-g-dot" style="background:#1e3ad1"></span>Bleu = tu es inscrit·e à un tournoi. <span class="ps-g-dot" style="background:#d6453d"></span>Rouge = ce tournoi tombe hors du planning de tes coachs : parles-en avec eux.</li>
      </ol>
    </div>
    <p class="ps-g-intro" style="margin:8px 0 0">Touche une semaine pour voir son détail juste sous le calendrier.</p>
  </details>`;
  host.innerHTML = `<div class="mrp-card ps-card">
    <h2 class="mrp-h">Ma saison ${escHtml(s.label)}</h2>
    ${guide}
    ${friseHtml}
    <div id="ps-week" class="ps-week"><span class="muted">Touche une semaine pour voir son programme.</span></div>
    ${todo.length ? `<h3 class="ps-h">Zones tournoi : à toi de t'inscrire</h3>
    <p class="muted" style="margin:0 0 4px;font-size:.8rem">Tes coachs ont prévu un tournoi ces week-ends. Touche une date pour la reporter dans le formulaire.</p>
    <div class="ps-todo">${todo.map((ws) => `<button type="button" class="ps-todo-b" data-ws="${ws}">${psWe(ws)}</button>`).join("")}</div>` : ""}
    <h3 class="ps-h">Mes inscriptions à venir</h3>
    ${mine.length ? mine.map((x) => `<div class="pl-wt"><span><b>${psRange(x.start_date, x.end_date)}</b> · ${escHtml(x.name)}${regHors(x) ? ' <span class="ps-hors">hors planification</span>' : ""}</span>${x.created_by === me ? `<button type="button" class="ps-del" data-id="${x.id}" aria-label="Retirer">✕</button>` : ""}</div>`).join("") : '<p class="muted" style="margin:4px 0">Aucune inscription pour l\'instant.</p>'}
    <div class="ps-add">
      <input type="text" id="ps-name" placeholder="Tournoi auquel je suis inscrit·e" />
      <label>Du<input type="date" id="ps-from" /></label>
      <label>Au<input type="date" id="ps-to" /></label>
      <button type="button" id="ps-add-btn">Ajouter</button>
    </div>
    <p id="ps-msg" class="muted" style="font-size:.8rem;margin:6px 0 0"></p>
  </div>`;
  // Détail d'une semaine : ce que les coachs ont prévu, et mes inscriptions.
  const showWeek = (i) => {
    const ws = weeks[i], k = kinds[ws], pl = planned(ws), rg = regsIn(ws);
    host.querySelectorAll(".ps-col").forEach((c) => c.classList.toggle("ps-col-sel", +c.dataset.i === i));
    $("ps-week").innerHTML = `<b>Semaine du ${psRange(ws, isoLocal(psDay(ws, 6)))}</b>
      <div>Programme : <b>${escHtml(PS_KINDS[k] || "rien de prévu")}</b></div>
      ${offIn(ws).length ? `<div>Pas d'entraînement : <b>${offIn(ws).map((d) => `${PS_DOW[psDay(d.day, 0).getDay()]} ${psD(d.day)} (${escHtml(d.label)})`).join(", ")}</b></div>` : ""}
      <div>Week-end (${psWe(ws)}) : ${pl.length ? `<b>zone tournoi</b>${rg.length ? "" : " — inscris-toi à un tournoi ce week-end"}` : "pas de zone tournoi"}</div>
      <div>Mes inscriptions : ${rg.length ? rg.map((x) => `${escHtml(x.name)} (${psRange(x.start_date, x.end_date)})`).join(", ") : "aucune"}</div>
      ${rg.some(regHors) ? '<div class="ps-hors" style="margin-top:4px">Cette inscription tombe hors de la planification des coachs : parles-en avec ton coach.</div>' : ""}`;
    const f = $("ps-from"); if (f && !f.value && ws >= today) { f.value = isoLocal(psDay(ws, 5)); $("ps-to").value = isoLocal(psDay(ws, 6)); }
  };
  host.querySelector(".ps-guide").addEventListener("toggle", (e) => {
    try { localStorage.setItem("ps-guide-closed", e.currentTarget.open ? "0" : "1"); } catch { /* stockage indisponible */ }
  });
  host.querySelectorAll(".ps-col").forEach((c) => c.addEventListener("click", () => showWeek(+c.dataset.i)));
  const cur = weeks.indexOf(thisMonday); if (cur >= 0) showWeek(cur);
  $("ps-from").addEventListener("change", () => { if (!$("ps-to").value || $("ps-to").value < $("ps-from").value) $("ps-to").value = $("ps-from").value; });
  host.querySelectorAll(".ps-todo-b").forEach((b) => b.addEventListener("click", () => {
    const i = weeks.indexOf(b.dataset.ws); if (i >= 0) showWeek(i);
    $("ps-from").value = isoLocal(psDay(b.dataset.ws, 5)); $("ps-to").value = isoLocal(psDay(b.dataset.ws, 6));
    $("ps-from").dispatchEvent(new Event("change")); $("ps-name").focus();
  }));
  host.querySelectorAll(".ps-del").forEach((b) => b.addEventListener("click", async () => {
    const x = mine.find((m) => m.id === b.dataset.id);
    if (!await ptConfirm(`Es-tu sûr·e de vouloir retirer ton inscription${x ? ` à <b>${escHtml(x.name)}</b> (${psRange(x.start_date, x.end_date)})` : ""} ?`, "Oui, retirer")) return;
    const { error } = await sb.from("plan_tournaments").delete().eq("id", b.dataset.id);
    if (error) { $("ps-msg").textContent = "Impossible : " + error.message; return; }
    renderPortalSeason(player);
  }));
  $("ps-add-btn").addEventListener("click", async () => {
    const name = $("ps-name").value.trim(), from = $("ps-from").value, to = $("ps-to").value || $("ps-from").value;
    if (name.length < 2 || !from) { $("ps-msg").textContent = "Indique le nom du tournoi et ses dates."; return; }
    if (to < from) { $("ps-msg").textContent = "La date de fin est avant la date de début."; return; }
    const { error } = await sb.from("plan_tournaments").insert({ person_id: player.person_id, week_start: from, start_date: from, end_date: to, name, source: "joueur", created_by: me });
    if (error) { $("ps-msg").textContent = "Impossible : " + error.message; return; }
    renderPortalSeason(player);
  });
}

/* ---------- Onglet « Feuille de match » (db/109) ----------
   Deux temps : 1) AVANT le match (infos, stratégie, préparation mentale) → « Valider l'avant-match » : figé ;
   2) APRÈS le match (résultat, analyse, ressentis, auto-évaluation) → « Envoyer la feuille » : figé pour de bon.
   Une feuille envoyée se relit mais ne se modifie plus : pour un changement important, le secrétariat. */
let mfSel = null, mfOpen = null, mfRows = [];
const mfState = (r) => r.author_role !== "joueur" ? "coach" : r.sent_at || !r.pre_sent_at ? "sent" : "pre";
const mfDate = (iso) => iso ? frShort(String(iso).slice(0, 10)) : "";
async function renderFeuille() {
  const host = $("view-feuille");
  if (!PLAYERS.length) { host.innerHTML = `<div class="pt-empty"><p>La feuille de match est réservée aux joueurs de compétition.</p></div>`; return; }
  mfSel = playerPick(mfSel);
  host.innerHTML = `${playerSelHtml(mfSel)}<div id="mf-body"><p class="muted" style="text-align:center;padding:12px">Chargement…</p></div>`;
  host.querySelectorAll(".mrp-player").forEach((b) => b.addEventListener("click", () => { mfSel = b.dataset.id; mfOpen = null; renderFeuille(); }));
  const { data } = await sb.rpc("portal_match_reports", { p_youth: mfSel });
  mfRows = data || [];
  if (mfOpen && mfOpen !== "new" && !mfRows.some((r) => r.id === mfOpen)) mfOpen = null;
  if (mfOpen) renderMfSheet(); else renderMfList();
}
function renderMfList() {
  const body = $("mf-body"); if (!body) return;
  const todo = mfRows.filter((r) => mfState(r) === "pre");
  const done = mfRows.filter((r) => mfState(r) !== "pre");
  const wins = done.filter((r) => r.result === "gagne").length, losses = done.filter((r) => r.result === "perdu").length;
  const cR = done.filter((r) => r.author_role === "coach"), jR = done.filter((r) => r.author_role === "joueur");
  const avg = (list, k) => { const v = list.map((r) => r[k]).filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; };
  const bar = (v, cls) => `<div class="mrp-bar"><div class="mrp-bar-fill ${cls}" style="width:${(v || 0) / 5 * 100}%"></div></div>`;
  const comp = MRP_RATINGS.map(([k, l]) => {
    const c = avg(cR, k), j = avg(jR, k);
    return `<div class="mrp-comp"><span class="mrp-comp-l">${escHtml(l)}</span>
      <div class="mrp-comp-line"><span class="mrp-tag coach">Coach ${c ?? "—"}</span>${bar(c, "coach")}</div>
      <div class="mrp-comp-line"><span class="mrp-tag joueur">Moi ${j ?? "—"}</span>${bar(j, "joueur")}</div></div>`;
  }).join("");
  const card = (r) => {
    const st = mfState(r);
    const res = r.result ? `<span class="${r.result === "gagne" ? "mrp-win" : "mrp-loss"}">${r.result === "gagne" ? "Gagné" : "Perdu"} ${escHtml(r.score || "")}</span>` : "";
    return `<button type="button" class="mf-card${st === "pre" ? " mf-card-todo" : ""}" data-id="${r.id}">
      <div class="mf-card-top"><span class="mrp-badge ${r.author_role}">${r.author_role === "coach" ? "Coach" : "Moi"}</span>
        <b>${escHtml(r.competition || (r.opponent ? "vs " + r.opponent : "Match"))}</b><span class="muted">${mfDate(r.match_date)}</span></div>
      <div class="mf-card-sub">${r.competition && r.opponent ? `vs ${escHtml(r.opponent)}${r.opponent_ranking ? ` (${escHtml(r.opponent_ranking.toUpperCase())})` : ""} · ` : ""}${st === "pre" ? '<span class="mf-todo-lbl">Après-match à remplir →</span>' : res}</div>
    </button>`;
  };
  body.innerHTML = `
    <button type="button" id="mf-new" class="comp-new">+ Nouvelle feuille de match</button>
    <p class="muted" style="font-size:.82rem;margin:6px 2px 12px">Remplis l'<b>avant-match</b> avant de jouer et valide-le. Reviens après le match pour remplir l'<b>après-match</b> et envoyer ta feuille.</p>
    ${todo.length ? `<h3 class="mrp-h2">À terminer</h3><div class="mf-list">${todo.map(card).join("")}</div>` : ""}
    <h3 class="mrp-h2">Mes feuilles</h3>
    ${done.length ? `<div class="mf-list">${done.map(card).join("")}</div>` : `<p class="muted" style="padding:4px 2px">Aucune feuille envoyée pour l'instant.</p>`}
    ${done.length ? `<div class="mrp-stats"><div class="mrp-stat ok"><b>${wins}</b><span>gagnés</span></div><div class="mrp-stat no"><b>${losses}</b><span>perdus</span></div><div class="mrp-stat"><b>${done.length}</b><span>feuilles</span></div></div>` : ""}
    ${cR.length && jR.length ? `<h3 class="mrp-h2">Ma vision vs celle du coach</h3><div class="mrp-comp-wrap">${comp}</div>` : ""}`;
  $("mf-new").addEventListener("click", () => { mfOpen = "new"; renderMfSheet(); window.scrollTo(0, 0); });
  body.querySelectorAll(".mf-card").forEach((b) => b.addEventListener("click", () => { mfOpen = b.dataset.id; renderMfSheet(); window.scrollTo(0, 0); }));
}
// Champ en lecture seule ; une réponse vide n'est pas affichée (feuille plus courte à relire).
const mfRo = (label, val) => val ? `<div class="mf-ro"><b>${escHtml(label)}</b><p>${escHtml(val).replace(/\n/g, "<br/>")}</p></div>` : "";
const mfTa = (id, label, hint = "") => `<label class="comp-f"><span>${escHtml(label)}</span>${hint ? `<small>${escHtml(hint)}</small>` : ""}<textarea id="${id}" rows="2"></textarea></label>`;
function renderMfSheet() {
  const body = $("mf-body"); if (!body) return;
  const player = PLAYERS.find((p) => p.person_id === mfSel);
  const r = mfOpen === "new" ? null : mfRows.find((x) => x.id === mfOpen);
  const st = r ? mfState(r) : "new";
  const L = mrpLabels(r?.author_role || "joueur", player.gender);
  const back = `<button type="button" id="mf-back" class="comp-back">← Mes feuilles de match</button>`;
  // Feuille remplie par un coach : lecture seule, présentation simple.
  if (st === "coach") {
    body.innerHTML = back + `<div class="mf-sheet"><div class="mf-sec"><div class="mf-sec-h"><span class="mrp-badge coach">Coach</span> Feuille de ${escHtml(r.author_name || "ton coach")}</div>
      <p class="muted" style="margin:0 0 8px">${mfDate(r.match_date)} · vs <b>${escHtml(r.opponent || "—")}</b>${r.opponent_ranking ? ` (${escHtml(r.opponent_ranking.toUpperCase())})` : ""} · ${r.result === "gagne" ? "Gagné" : r.result === "perdu" ? "Perdu" : ""} ${escHtml(r.score || "")}</p>
      ${MR_KEYS.filter((k) => r[k]).map((k) => mfRo(L[k], r[k])).join("")}${r.comment ? mfRo("Commentaire", r.comment) : ""}</div></div>`;
    $("mf-back").addEventListener("click", () => { mfOpen = null; renderMfList(); });
    return;
  }
  const rankOpts = MRP_RANKINGS.map((x) => `<option value="${x}">${x === "autre" ? "Autre" : x.toUpperCase()}</option>`).join("");
  // --- 1. Avant le match ---
  const pre = st === "new"
    ? `<div class="mrp-grid">
        <label>Date du match<input type="date" id="mf-date" value="${isoLocal(new Date())}"></label>
        <label>Tournoi<input type="text" id="mf-competition" placeholder="ex. Tournoi de Nyon"></label>
        <label>Adversaire<input type="text" id="mf-opponent" placeholder="si tu le connais"></label>
        <label>Classement adversaire<select id="mf-rank"><option value="">—</option>${rankOpts}</select></label>
      </div>
      ${MR_PRE_KEYS.map((k) => mfTa("mf-" + k, L[k])).join("")}
      <h4 class="mf-sub">Ma préparation</h4>
      ${MF_PREP.map(([k, l, h]) => mfTa("mf-prep-" + k, l, h)).join("")}
      <p class="mf-warn">Une fois validé, l'avant-match ne peut plus être modifié.</p>
      <div class="comp-actions"><button type="button" id="mf-pre-ok">Valider l'avant-match</button><span id="mf-status" class="muted"></span></div>`
    : `${mfRo("Date du match", mfDate(r.match_date))}${mfRo("Tournoi", r.competition)}${mfRo("Adversaire", r.opponent ? r.opponent + (r.opponent_ranking ? ` (${r.opponent_ranking.toUpperCase()})` : "") : "")}
      ${MR_PRE_KEYS.map((k) => mfRo(L[k], r[k])).join("")}
      ${Object.keys(r.prep || {}).length ? '<h4 class="mf-sub">Ma préparation</h4>' : ""}${MF_PREP.map(([k, l]) => mfRo(l, (r.prep || {})[k])).join("")}`;
  // --- 2. Après le match ---
  const stars = MRP_RATINGS.map(([k, l]) => `<div class="mrp-rate"><span>${escHtml(l)}</span><div class="mrp-stars" data-k="${k}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="mrp-star" data-v="${n}">${n}</button>`).join("")}</div></div>`).join("");
  let post;
  if (st === "new") post = `<p class="muted" style="margin:0">Tu rempliras cette partie <b>après ton match</b>, une fois l'avant-match validé.</p>`;
  else if (st === "pre") post = `<div class="mrp-grid">
        <label>Résultat<select id="mf-result"><option value="">—</option><option value="gagne">Gagné</option><option value="perdu">Perdu</option></select></label>
        <label>Score<input type="text" id="mf-score" placeholder="ex. 6-3 6-4"></label>
        ${r.opponent ? "" : `<label>Adversaire<input type="text" id="mf-opponent2"></label><label>Classement adversaire<select id="mf-rank2"><option value="">—</option>${rankOpts}</select></label>`}
      </div>
      ${MR_POST_KEYS.map((k) => mfTa("mf-" + k, L[k])).join("")}
      <h4 class="mf-sub">Mon analyse</h4>
      ${MF_ANALYSE.map(([k, l, h]) => mfTa("mf-bilan-" + k, l, h)).join("")}
      <h4 class="mf-sub">Mon auto-évaluation (1 à 5)</h4>
      <div class="mrp-ratings">${stars}</div>
      <label class="comp-f"><span>Commentaire</span><textarea id="mf-comment" rows="2"></textarea></label>
      <p class="mf-warn">Une fois envoyée, tu pourras relire ta feuille mais plus la modifier.</p>
      <div class="comp-actions"><button type="button" id="mf-post-ok">Envoyer la feuille</button><span id="mf-status" class="muted"></span></div>`;
  else post = `${mfRo("Résultat", r.result === "gagne" ? `Gagné ${r.score || ""}` : r.result === "perdu" ? `Perdu ${r.score || ""}` : "")}
      ${MR_POST_KEYS.map((k) => mfRo(L[k], r[k])).join("")}
      ${Object.keys(r.bilan || {}).length ? '<h4 class="mf-sub">Mon analyse</h4>' : ""}${MF_ANALYSE.map(([k, l]) => mfRo(l, (r.bilan || {})[k])).join("")}
      <h4 class="mf-sub">Mon auto-évaluation</h4>
      <div class="mf-rates">${MRP_RATINGS.map(([k, l]) => `<div class="mf-rate"><span>${escHtml(l)}</span><b>${r[k] ? "★".repeat(r[k]) + "☆".repeat(5 - r[k]) : "—"}</b></div>`).join("")}</div>
      ${r.comment ? mfRo("Commentaire", r.comment) : ""}`;
  const stamp = (d) => d ? new Date(d).toLocaleString("fr-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  body.innerHTML = back + `<div class="mf-sheet">
    ${st === "sent" ? `<div class="mf-locked">✓ Feuille envoyée le ${stamp(r.sent_at || r.created_at)}. Tu peux la relire, mais plus la modifier. Pour un changement important, contacte le secrétariat : <a href="tel:+41216461350">${SECRETARIAT_TEL}</a> ou via le <a href="contact.html">formulaire de contact</a>.</div>` : ""}
    <div class="mf-sec${st === "new" ? " mf-sec-on" : ""}">
      <div class="mf-sec-h"><span class="mf-step">1</span>Avant le match${st !== "new" ? `<span class="mf-done">Validé le ${stamp(r.pre_sent_at || r.created_at)}</span>` : ""}</div>
      ${st === "pre" ? `<details class="mf-fold"><summary>Revoir mon avant-match</summary>${pre}</details>` : pre}
    </div>
    <div class="mf-sec${st === "pre" ? " mf-sec-on" : ""}${st === "new" ? " mf-sec-off" : ""}">
      <div class="mf-sec-h"><span class="mf-step">2</span>Après le match${st === "sent" ? `<span class="mf-done">Envoyé le ${stamp(r.sent_at || r.created_at)}</span>` : ""}</div>
      ${post}
    </div>
  </div>`;
  $("mf-back").addEventListener("click", () => { mfOpen = null; renderMfList(); });
  body.querySelectorAll(".mrp-stars").forEach((box) => box.querySelectorAll(".mrp-star").forEach((b) => b.addEventListener("click", () => {
    box.dataset.val = b.dataset.v;
    box.querySelectorAll(".mrp-star").forEach((x) => x.classList.toggle("on", Number(x.dataset.v) <= Number(b.dataset.v)));
  })));
  // Après-match rouvert par le secrétariat : on repart de ce que le jeune avait envoyé.
  if (st === "pre") {
    const put = (id, v) => { const el = $(id); if (el && v != null) el.value = v; };
    put("mf-result", r.result); put("mf-score", r.score); put("mf-comment", r.comment);
    for (const k of MR_POST_KEYS) put("mf-" + k, r[k]);
    for (const [k] of MF_ANALYSE) put("mf-bilan-" + k, (r.bilan || {})[k]);
    for (const [k] of MRP_RATINGS) if (r[k]) body.querySelector(`.mrp-stars[data-k="${k}"] .mrp-star[data-v="${r[k]}"]`)?.click();
  }
  const val = (id) => ($(id)?.value || "").trim();
  if (st === "new") $("mf-pre-ok").addEventListener("click", async (e) => {
    if (!val("mf-date")) { $("mf-status").textContent = "Indique la date du match."; return; }
    if (!confirm("Valider l'avant-match ? Tu ne pourras plus le modifier.")) return;
    const data = { match_date: val("mf-date"), competition: val("mf-competition"), opponent: val("mf-opponent"), opponent_ranking: val("mf-rank"), prep: {} };
    for (const k of MR_PRE_KEYS) data[k] = val("mf-" + k);
    for (const [k] of MF_PREP) data.prep[k] = val("mf-prep-" + k);
    e.currentTarget.disabled = true; $("mf-status").textContent = "Enregistrement…";
    const { data: id, error } = await sb.rpc("portal_mr_pre", { p_youth: mfSel, p_data: data });
    if (error) { $("mf-status").textContent = "Erreur : " + error.message; e.currentTarget.disabled = false; return; }
    mfOpen = id; renderFeuille();
  });
  if (st === "pre") $("mf-post-ok").addEventListener("click", async (e) => {
    if (!val("mf-result")) { $("mf-status").textContent = "Indique le résultat du match."; return; }
    if (!confirm("Envoyer la feuille ? Tu pourras la relire, mais plus la modifier.")) return;
    const rating = (k) => body.querySelector(`.mrp-stars[data-k="${k}"]`)?.dataset.val || null;
    const data = { result: val("mf-result"), score: val("mf-score"), opponent: val("mf-opponent2"), opponent_ranking: val("mf-rank2"), comment: val("mf-comment"), bilan: {} };
    for (const k of MR_POST_KEYS) data[k] = val("mf-" + k);
    for (const [k] of MF_ANALYSE) data.bilan[k] = val("mf-bilan-" + k);
    for (const [k] of MRP_RATINGS) data[k] = rating(k);
    e.currentTarget.disabled = true; $("mf-status").textContent = "Envoi…";
    const { error } = await sb.rpc("portal_mr_post", { p_youth: mfSel, p_id: r.id, p_data: data });
    if (error) { $("mf-status").textContent = "Erreur : " + error.message; e.currentTarget.disabled = false; return; }
    renderFeuille();
  });
}

/* ---------- Onglet « Physique » (db/111) ----------
   • Routine : les programmes que le staff m'a attribués (échauffement, décrassage, routine du soir…).
   • Prépa physique : fil type chat avec le staff (texte, lien, photo, vidéo, document). */
let phSel = null, phSub = "routine";
const PH_KIND = { echauffement: "Avant l'effort", decrassage: "Après l'effort", soir: "Chaque soir", renfo: "Renforcement", autre: "Programme" };
function renderPhysique() {
  const host = $("view-physique");
  if (!PLAYERS.length) { host.innerHTML = `<div class="pt-empty"><p>Réservé aux joueurs de compétition.</p></div>`; return; }
  phSel = playerPick(phSel);
  // Compétition et performance : routines seules, pas de discussion Prépa physique (db/118).
  if (!ELITE.has(phSel)) {
    phSub = "routine";
    host.innerHTML = playerSelHtml(phSel) + `<div id="ph-sub"></div>`;
    host.querySelectorAll(".mrp-player").forEach((b) => b.addEventListener("click", () => { phSel = b.dataset.id; renderPhysique(); }));
    renderPhRoutines(); return;
  }
  host.innerHTML = playerSelHtml(phSel) + `
    <div class="comp-subtabs">
      <button type="button" class="comp-subtab ${phSub === "routine" ? "on" : ""}" data-s="routine">Routine</button>
      <button type="button" class="comp-subtab ${phSub === "prepa" ? "on" : ""}" data-s="prepa">Prépa physique</button>
    </div>
    <div id="ph-sub"></div>`;
  host.querySelectorAll(".mrp-player").forEach((b) => b.addEventListener("click", () => { phSel = b.dataset.id; renderPhysique(); }));
  host.querySelectorAll(".comp-subtab").forEach((b) => b.addEventListener("click", () => {
    phSub = b.dataset.s;
    host.querySelectorAll(".comp-subtab").forEach((x) => x.classList.toggle("on", x === b));
    renderPhSub();
  }));
  renderPhSub();
}
// Vignette d'un exercice : illustration (trait fin bleu, /assets/phys/<img>.svg) + nom, dosage et consigne dessous.
const phExCard = (x, i) => `<div class="ph-card">
    ${x.img ? `<div class="ph-pic"><img src="/assets/phys/${escHtml(x.img)}.svg" alt="" loading="lazy"></div>` : ""}
    <div class="ph-card-b"><div class="ph-card-t"><span class="ph-num">${i + 1}</span><b>${escHtml(x.name || "")}</b></div>
      ${x.dose && x.dose !== "—" ? `<span class="ph-dose">${escHtml(x.dose)}</span>` : ""}
      ${x.how ? `<p>${escHtml(x.how)}</p>` : ""}</div></div>`;
function renderPhSub() { if (phSub === "prepa") renderPhThread(); else renderPhRoutines(); }
async function renderPhRoutines() {
  const host = $("ph-sub"); if (!host) return;
  host.innerHTML = '<p class="muted" style="text-align:center;padding:12px">Chargement…</p>';
  const { data, error } = await sb.rpc("portal_phys_routines", { p_youth: phSel });
  if ($("ph-sub") !== host) return;
  const rows = error ? [] : (data || []);
  if (!rows.length) { host.innerHTML = `<div class="pt-empty"><p>Pas encore de routine pour toi. Ton coach t'en attribuera bientôt.</p></div>`; return; }
  // Toutes fermées à l'arrivée : on voit d'un coup d'œil qu'il y a plusieurs routines.
  host.innerHTML = `<p class="muted ph-hint">Touche une routine pour l'ouvrir.</p>` + rows.map((r) => `<details class="ph-rt ph-k-${escHtml(r.kind)}">
      <summary><span class="ph-kind">${escHtml(PH_KIND[r.kind] || "Programme")}</span><b>${escHtml(r.title)}</b>${r.duration ? `<span class="ph-dur">⏱ ${escHtml(r.duration)}</span>` : ""}</summary>
      ${r.intro ? `<p class="ph-intro">${escHtml(r.intro).replace(/\n/g, "<br/>")}</p>` : ""}
      <div class="ph-cards">${(r.exercises || []).map(phExCard).join("")}</div>
    </details>`).join("");
}
// Fil « Prépa physique » : les photos et vidéos s'affichent directement (liens signés, bucket privé « physique »).
const phIsImg = (n) => /\.(jpe?g|png|gif|webp|heic)$/i.test(n || "");
const phIsVid = (n) => /\.(mp4|mov|m4v|webm)$/i.test(n || "");
async function renderPhThread() {
  const host = $("ph-sub"); if (!host) return;
  host.innerHTML = '<p class="muted" style="text-align:center;padding:12px">Chargement…</p>';
  const { data } = await sb.rpc("phys_thread_list", { p_youth: phSel });
  if ($("ph-sub") !== host) return;
  const rows = data || [];
  const msg = (m) => {
    const side = m.author_is_staff ? "staff" : "youth";
    const media = m.file_path ? (phIsImg(m.file_name) ? `<img class="ph-media" data-path="${escHtml(m.file_path)}" alt="">`
      : phIsVid(m.file_name) ? `<video class="ph-media" data-path="${escHtml(m.file_path)}" controls playsinline preload="metadata"></video>`
      : `<button type="button" class="mt-file-dl" data-path="${escHtml(m.file_path)}">📎 ${escHtml(m.file_name || "document")}</button>`) : "";
    return `<div class="mt-msg ${side}"><div class="mt-meta"><b>${escHtml(m.author_name || "—")}</b> <span class="mt-role ${side}">${m.author_is_staff ? "Coach" : "Moi"}</span> <span class="muted">${frShort((m.created_at || "").slice(0, 10))}</span></div>${m.body ? `<div class="mt-text">${escHtml(m.body).replace(/\n/g, "<br/>")}</div>` : ""}${m.link_url ? `<a href="${escHtml(m.link_url)}" target="_blank" rel="noopener" class="mt-linkout">🔗 ${escHtml(m.link_url)}</a>` : ""}${media}</div>`;
  };
  host.innerHTML = `<div class="mt-thread ph-thread">${rows.length ? rows.map(msg).join("") : `<p class="muted" style="text-align:center;padding:12px">Aucun message pour l'instant. Tes coachs peuvent t'envoyer ici des exercices, des photos ou des vidéos, et tu peux leur répondre.</p>`}</div>
    <div class="mt-composer">
      <textarea class="mt-body" rows="2" placeholder="Écrire un message…"></textarea>
      <div class="mt-crow"><label class="mt-file-lbl">📎 Photo, vidéo ou document<input type="file" class="mt-file" hidden></label><span class="mt-file-name muted"></span><span class="spacer"></span><button type="button" class="mt-send">Envoyer</button></div>
      <span class="mt-status muted"></span>
    </div>`;
  const th = host.querySelector(".ph-thread"); th.scrollTop = th.scrollHeight;
  host.querySelectorAll(".ph-media").forEach(async (el) => {
    const { data: u } = await sb.storage.from("physique").createSignedUrl(el.dataset.path, 3600);
    if (u?.signedUrl) el.src = u.signedUrl;
  });
  host.querySelectorAll(".mt-file-dl").forEach((b) => b.addEventListener("click", async () => {
    const { data: u } = await sb.storage.from("physique").createSignedUrl(b.dataset.path, 300);
    if (u?.signedUrl) window.open(u.signedUrl, "_blank"); else alert("Impossible d'ouvrir le fichier.");
  }));
  const fi = host.querySelector(".mt-file");
  fi.addEventListener("change", () => { host.querySelector(".mt-file-name").textContent = fi.files[0]?.name || ""; });
  host.querySelector(".mt-send").addEventListener("click", async (e) => {
    const body = host.querySelector(".mt-body").value.trim(), f = fi.files[0], st = host.querySelector(".mt-status");
    if (!body && !f) return;
    if (f && f.size > 50 * 1024 * 1024) { st.textContent = "Fichier trop lourd (50 Mo au maximum)."; return; }
    e.currentTarget.disabled = true; st.textContent = "Envoi…";
    let fp = null, fn = null;
    if (f) {
      const path = `${phSel}/${crypto.randomUUID()}_${f.name.replace(/[^\w.\-]/g, "_")}`;
      const up = await sb.storage.from("physique").upload(path, f, { contentType: f.type || undefined });
      if (up.error) { st.textContent = "Échec du fichier : " + up.error.message; e.currentTarget.disabled = false; return; }
      fp = path; fn = f.name;
    }
    const { error } = await sb.rpc("phys_thread_post", { p_youth: phSel, p_body: body || null, p_link: null, p_file_path: fp, p_file_name: fn });
    if (error) { st.textContent = "Erreur : " + error.message; e.currentTarget.disabled = false; return; }
    renderPhThread();
  });
}

/* ---------- Onglet « Contact » (db/111) ----------
   Écrit au secrétariat : le message arrive dans la Messagerie de la console (boîte info@teamlausanne.ch),
   sujet « ESPACE PRIVÉ - Prénom Nom » du jeune concerné ; la réponse part vers l'adresse du compte. */
let ctSel = null;
async function renderContact() {
  const host = $("view-contact");
  const email = (await sb.auth.getUser()).data.user?.email || "";
  if (!ctSel || !YOUTHS.some((y) => y.person_id === ctSel))
    ctSel = (selYouth !== "all" && YOUTHS.some((y) => y.person_id === selYouth)) ? selYouth : (YOUTHS[0]?.person_id || null);
  const who = () => { const y = YOUTHS.find((x) => x.person_id === ctSel); return y ? `${y.first_name} ${y.last_name || ""}`.trim() : ""; };
  host.innerHTML = `<div class="mrp-card ct-card">
      <h2 class="mrp-h">Écrire au secrétariat</h2>
      <p class="muted" style="margin:0 0 12px;font-size:.88rem">Ton message arrive directement chez Team Lausanne (info@teamlausanne.ch). On te répond par e-mail${email ? ` à <b>${escHtml(email)}</b>` : ""}.</p>
      ${YOUTHS.length > 1 ? `<label class="comp-f"><span>Concerne</span><select id="ct-youth">${YOUTHS.map((y) => `<option value="${y.person_id}"${y.person_id === ctSel ? " selected" : ""}>${escHtml(y.first_name)} ${escHtml(y.last_name || "")}</option>`).join("")}</select></label>` : ""}
      <div class="ct-subject">Sujet : <b id="ct-subj"></b></div>
      <label class="comp-f"><span>Message</span><textarea id="ct-msg" rows="6" maxlength="5000" placeholder="Ta question, une absence à signaler, un changement d'adresse…"></textarea></label>
      <div class="comp-actions" style="padding-bottom:6px"><button type="button" id="ct-send">Envoyer</button><span id="ct-status" class="muted"></span></div>
      <p class="muted" style="font-size:.8rem;margin:6px 0 0">Secrétariat : <a href="tel:+41216461350">${SECRETARIAT_TEL}</a> · du lundi au vendredi, 9h00–12h00 et 13h00–17h00.</p>
    </div>`;
  const subj = () => { $("ct-subj").textContent = `ESPACE PRIVÉ - ${who() || "…"}`; };
  subj();
  $("ct-youth")?.addEventListener("change", () => { ctSel = $("ct-youth").value; subj(); });
  $("ct-send").addEventListener("click", async (e) => {
    const msg = $("ct-msg").value.trim(), st = $("ct-status");
    if (msg.length < 2) { st.textContent = "Écris ton message."; return; }
    e.currentTarget.disabled = true; st.textContent = "Envoi…";
    const { error } = await sb.rpc("portal_contact", { p_youth: ctSel, p_message: msg });
    if (error) { st.textContent = "Erreur : " + error.message; e.currentTarget.disabled = false; return; }
    host.querySelector(".ct-card").innerHTML = `<h2 class="mrp-h">Merci !</h2>
      <p style="margin:0 0 10px">Ton message est bien parti au secrétariat. On te répond dès que possible${email ? `, par e-mail à <b>${escHtml(email)}</b>` : ""}.</p>
      <button type="button" id="ct-again" class="ghost">Écrire un autre message</button>`;
    $("ct-again").addEventListener("click", renderContact);
  });
}

let compSel = null;
let compSub = "messages";
// Onglet Mental : « Messages » (discussion avec le coach mental), « Focus de la semaine » (db/122) et « Routines ».
// Les questions d'avant / après compétition sont dans l'onglet « Feuille de match » (27.09.2026).
function renderComp() {
  const host = $("view-comp");
  if (!PLAYERS.length) { host.innerHTML = `<div class="pt-empty"><p>Réservé aux joueurs de compétition.</p></div>`; return; }
  compSel = playerPick(compSel);
  // Compétition et performance : pas de Messages ni d'Après séance, seulement les routines mentales (db/119),
  // conseils rédigés et attribués par le coach mental dans la console (Mental › Routines).
  if (!ELITE.has(compSel)) {
    host.innerHTML = playerSelHtml(compSel) + `<div id="comp-sub"></div>`;
    host.querySelectorAll(".mrp-player").forEach((b) => b.addEventListener("click", () => { compSel = b.dataset.id; renderComp(); }));
    renderCompRoutines(); return;
  }
  if (!["messages", "focus", "routines"].includes(compSub)) compSub = "messages";
  host.innerHTML = playerSelHtml(compSel) + `
    <div class="comp-subtabs">
      <button type="button" class="comp-subtab ${compSub === "messages" ? "on" : ""}" data-s="messages">Messages</button>
      <button type="button" class="comp-subtab ${compSub === "focus" ? "on" : ""}" data-s="focus">Focus de la semaine</button>
      <button type="button" class="comp-subtab ${compSub === "routines" ? "on" : ""}" data-s="routines">Routines</button>
    </div>
    <div id="comp-sub"></div>`;
  host.querySelectorAll(".mrp-player").forEach((b) => b.addEventListener("click", () => { compSel = b.dataset.id; renderComp(); }));
  host.querySelectorAll(".comp-subtab").forEach((b) => b.addEventListener("click", () => {
    compSub = b.dataset.s;
    host.querySelectorAll(".comp-subtab").forEach((x) => x.classList.toggle("on", x === b));
    renderCompSub();
  }));
  renderCompSub();
}
// Routines mentales attribuées au jeune : une carte par routine (moment, introduction, conseils numérotés).
const MNR_ICON = { avant: "🎯", pendant: "🔥", apres: "🤝", autre: "💡" };
async function renderCompRoutines() {
  const host = $("comp-sub"); if (!host) return;
  host.innerHTML = '<p class="muted" style="text-align:center;padding:12px">Chargement…</p>';
  const { data, error } = await sb.rpc("portal_mental_routines", { p_youth: compSel });
  if ($("comp-sub") !== host) return;
  const rows = error ? [] : (data || []);
  if (!rows.length) { host.innerHTML = `<div class="pt-empty"><p>Pas encore de routine mentale pour toi. Ton coach t'en attribuera bientôt.</p></div>`; return; }
  host.innerHTML = rows.map((r) => `<div class="mrp-card tips-card">
      <h2 class="mrp-h">${MNR_ICON[r.kind] || "💡"} ${escHtml(r.title)}</h2>
      ${r.intro ? `<p class="muted tips-intro">${escHtml(r.intro)}</p>` : ""}
      <ol class="tips-ol">${(r.items || []).map((x) => `<li><b>${escHtml(x.title || "")}</b>${x.text ? `<span>${escHtml(x.text)}</span>` : ""}</li>`).join("")}</ol>
    </div>`).join("");
}
function renderCompSub() {
  if (compSub === "focus") renderCompFocus(); else if (compSub === "routines") renderCompRoutines(); else renderCompMessages();
}
// --- Messages (discussion avec l'encadrement) ---
async function renderCompMessages() {
  const host = $("comp-sub"); if (!host) return;
  host.innerHTML = '<p class="muted" style="text-align:center;padding:12px">Chargement…</p>';
  const { data } = await sb.rpc("mental_thread_list", { p_youth: compSel });
  const rows = data || [];
  const msgs = rows.length ? rows.map(ptMtMsg).join("") : `<p class="muted" style="text-align:center;padding:12px">Aucun message pour l'instant. Ton coach mental peut t'écrire ici, et tu peux répondre.</p>`;
  host.innerHTML = `<div class="mt-thread">${msgs}</div>
    <div class="mt-composer">
      <textarea class="mt-body" rows="2" placeholder="Écrire un message…"></textarea>
      <input type="url" class="mt-link" placeholder="Lien (https://…) — optionnel" />
      <div class="mt-crow"><label class="mt-file-lbl">📎 Document<input type="file" class="mt-file" hidden></label><span class="mt-file-name muted"></span><span class="spacer"></span><button type="button" class="mt-send">Envoyer</button></div>
      <span class="mt-status muted"></span>
    </div>`;
  const fi = host.querySelector(".mt-file");
  fi.addEventListener("change", () => { host.querySelector(".mt-file-name").textContent = fi.files[0]?.name || ""; });
  host.querySelector(".mt-send").addEventListener("click", ptMtSend);
  host.querySelectorAll(".mt-file-dl").forEach((b) => b.addEventListener("click", () => ptMtOpen(b.dataset.path)));
}
function ptMtMsg(m) {
  const side = m.author_is_staff ? "staff" : "youth";
  const link = m.link_url ? `<a href="${escHtml(m.link_url)}" target="_blank" rel="noopener" class="mt-linkout">🔗 ${escHtml(m.link_url)}</a>` : "";
  const file = m.file_path ? `<button type="button" class="mt-file-dl" data-path="${escHtml(m.file_path)}">📎 ${escHtml(m.file_name || "document")}</button>` : "";
  const body = m.body ? escHtml(m.body).replace(/\n/g, "<br/>") : "";
  return `<div class="mt-msg ${side}"><div class="mt-meta"><b>${escHtml(m.author_name || "—")}</b> <span class="mt-role ${side}">${m.author_is_staff ? "Coach" : "Moi"}</span> <span class="muted">${frShort((m.created_at || "").slice(0, 10))}</span></div>${body ? `<div class="mt-text">${body}</div>` : ""}${link}${file}</div>`;
}
async function ptMtSend() {
  const host = $("comp-sub");
  const body = host.querySelector(".mt-body").value.trim(), link = host.querySelector(".mt-link").value.trim();
  const fi = host.querySelector(".mt-file"), f = fi.files[0];
  if (!body && !link && !f) return;
  const st = host.querySelector(".mt-status"); st.textContent = "Envoi…";
  let fp = null, fn = null;
  if (f) {
    if (f.size > 15 * 1024 * 1024) { st.textContent = "Fichier trop lourd (max 15 Mo)."; return; }
    const path = `${compSel}/${crypto.randomUUID()}_${f.name.replace(/[^\w.\-]/g, "_")}`;
    const up = await sb.storage.from("mental").upload(path, f);
    if (up.error) { st.textContent = "Échec du fichier : " + up.error.message; return; }
    fp = path; fn = f.name;
  }
  const { error } = await sb.rpc("mental_thread_post", { p_youth: compSel, p_body: body || null, p_link: link || null, p_file_path: fp, p_file_name: fn });
  if (error) { st.textContent = "Erreur : " + error.message; return; }
  renderCompMessages();
}
async function ptMtOpen(path) {
  const { data, error } = await sb.storage.from("mental").createSignedUrl(path, 120);
  if (error || !data) { alert("Impossible d'ouvrir le fichier."); return; }
  window.open(data.signedUrl, "_blank");
}
// --- Le focus de la semaine (db/122) : UN focus par semaine (lundi → dimanche), modifiable 24 h, puis figé ---
const fcWeek = (ws) => `semaine du ${frShort(ws)} au ${frShort(isoLocal(addDays(new Date(ws + "T12:00:00"), 6)))}`;
const fcUntil = (ts) => { const d = new Date(new Date(ts).getTime() + 24 * 3600 * 1000); return `${DOW[d.getDay()]} ${frShort(isoLocal(d))} à ${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`; };
async function renderCompFocus(editId) {
  const host = $("comp-sub"); if (!host) return;
  host.innerHTML = '<p class="muted" style="text-align:center;padding:12px">Chargement…</p>';
  const { data, error } = await sb.rpc("portal_focus_list", { p_youth: compSel });
  if ($("comp-sub") !== host) return;
  if (error) { host.innerHTML = `<p class="error">${escHtml(error.message)}</p>`; return; }
  const rows = data || [], cur = rows.find((r) => r.is_current), past = rows.filter((r) => !r.is_current);
  const editing = editId ? rows.find((r) => r.id === editId) : null;
  const form = (val) => `<label class="comp-f"><span>Mon focus</span><textarea id="fc-body" rows="3" maxlength="4000" placeholder="ex. Rester calme et respirer entre les points quand je suis mené·e.">${escHtml(val || "")}</textarea></label>
      <div class="comp-actions"><button type="button" id="fc-save">${editing ? "Enregistrer" : "Valider mon focus"}</button>${editing ? '<button type="button" class="ghost" id="fc-cancel">Annuler</button>' : ""}<span id="fc-status" class="muted"></span></div>`;
  let top;
  if (!cur) {
    top = `<div class="comp-head fc-card">
      <h3 class="mrp-h2" style="margin:0 0 4px">Mon focus de la ${fcWeek(isoLocal(addDays(new Date(), -((new Date().getDay() + 6) % 7))))}</h3>
      <p class="muted" style="margin:0 0 10px;font-size:.88rem">Choisis <b>un seul point</b> sur lequel tu veux te concentrer cette semaine, à l'entraînement comme en match. Tu pourras le modifier pendant 24 h, ensuite il est enregistré pour la semaine.</p>
      ${form("")}</div>`;
  } else if (editing && editing.id === cur.id) {
    top = `<div class="comp-head fc-card"><h3 class="mrp-h2" style="margin:0 0 8px">Modifier mon focus · ${fcWeek(cur.week_start)}</h3>${form(cur.body)}</div>`;
  } else {
    top = `<div class="comp-head fc-card fc-done">
      <div class="fc-done-h">✓ Tu as déjà rempli ton focus cette semaine</div>
      <div class="muted" style="font-size:.8rem;margin:0 0 6px">${fcWeek(cur.week_start)} · noté le ${frShort(isoLocal(new Date(cur.created_at)))}</div>
      <p class="fc-body">${escHtml(cur.body).replace(/\n/g, "<br/>")}</p>
      ${cur.can_edit ? `<div class="comp-actions" style="padding-bottom:0"><button type="button" class="ghost fc-edit" data-id="${cur.id}">Modifier</button><button type="button" class="ghost fc-del" data-id="${cur.id}">Supprimer</button><span class="muted" style="font-size:.78rem">possible jusqu'à ${fcUntil(cur.created_at)}</span></div>`
        : '<p class="muted" style="margin:6px 0 0;font-size:.8rem">Prochain focus à remplir dès lundi.</p>'}
    </div>`;
  }
  host.innerHTML = top + `<h3 class="mrp-h2" style="margin-top:4px">Mes focus précédents</h3>
    ${past.length ? `<div class="comp-list">${past.map((r) => `<div class="comp-card" style="cursor:default">
      <div class="comp-card-top"><b>${escHtml(fcWeek(r.week_start))}</b></div>
      <p class="fc-body">${escHtml(r.body).replace(/\n/g, "<br/>")}</p></div>`).join("")}</div>`
      : '<p class="muted" style="text-align:center;padding:8px">Rien encore.</p>'}`;
  host.querySelectorAll(".fc-edit").forEach((b) => b.addEventListener("click", () => renderCompFocus(b.dataset.id)));
  host.querySelectorAll(".fc-del").forEach((b) => b.addEventListener("click", async () => {
    if (!await ptConfirm("Es-tu sûr·e de vouloir supprimer ton focus de la semaine ?", "Oui, supprimer")) return;
    const { error: e } = await sb.rpc("portal_focus_delete", { p_youth: compSel, p_id: b.dataset.id });
    if (e) { alert(e.message); return; }
    renderCompFocus();
  }));
  $("fc-cancel")?.addEventListener("click", () => renderCompFocus());
  $("fc-save")?.addEventListener("click", async (e) => {
    const body = $("fc-body").value.trim(), st = $("fc-status");
    if (!body) { st.textContent = "Écris ton focus."; return; }
    e.currentTarget.disabled = true; st.textContent = "Enregistrement…";
    const { error: er } = await sb.rpc("portal_focus_save", { p_youth: compSel, p_id: editing?.id || null, p_body: body });
    if (er) { st.textContent = "Erreur : " + er.message; e.currentTarget.disabled = false; return; }
    renderCompFocus();
  });
}
