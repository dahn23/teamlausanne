// Console admin — CRM membres (accès staff uniquement).
import { sb, requireLogin, myRoles, hasAny, STAFF_ROLES, frDate, frDateTime, jours } from "./common.js";
import "./pretty-select.js";
import "./pretty-date.js";

const $ = (id) => document.getElementById(id);
// Petite coupe SVG (remplace l'emoji 🏆 dans les tableaux)
const ICO_CUP = '<svg viewBox="0 0 24 24" width="13" height="13" style="vertical-align:-1px" fill="none" stroke="#c8901f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v4.5a4 4 0 0 1-8 0V4z"/><path d="M8 5.5H5V7a3 3 0 0 0 3 3M16 5.5h3V7a3 3 0 0 1-3 3"/><path d="M10 13.5V16h4v-2.5M8 20h8M12 16v4"/></svg>';
let people = [];
let meId = null;
let meEmail = null;
let meName = null;
let myPersonId = null;
const pad2 = (n) => String(n).padStart(2, "0");

// ---- Garde d'accès : connecté + rôle staff ----
const session = await requireLogin();
if (session) {
  $("who").textContent = session.user.email;
  const roles = await myRoles();
  $("loader").classList.add("hidden");
  if (!hasAny(roles, STAFF_ROLES)) {
    $("denied").classList.remove("hidden");
  } else {
    $("console").classList.remove("hidden");
    meId = session.user.id;
    meEmail = session.user.email;
    meName = meEmail;
    try {
      const { data: prof } = await sb.from("profiles").select("person_id").eq("user_id", meId).maybeSingle();
      if (prof?.person_id) {
        myPersonId = prof.person_id;
        const { data: me } = await sb.from("people").select("first_name,last_name").eq("id", prof.person_id).maybeSingle();
        if (me) meName = `${me.first_name || ""} ${me.last_name || ""}`.trim() || meEmail;
      }
    } catch (_) {}
    init(roles);
  }
}

// Accès aux onglets par rôle (défense en profondeur : la RLS protège déjà
// les écritures en base ; ceci masque l'UI selon le rôle).
const DEFAULT_TAB_ACCESS = {
  superadmin: ["membres", "roles", "resa", "cours", "phystests", "gamezone", "caisse", "stages", "stats"],
  admin:      ["membres", "roles", "resa", "cours", "phystests", "gamezone", "caisse", "stages", "stats"],
  secretaire: ["membres", "resa", "caisse", "stages", "stats"],
  head_coach: ["resa", "cours", "phystests", "stages"],
  coach:      ["resa", "cours", "phystests"],
  organisateur: ["gamezone"],
  responsable:  ["gamezone"],
};
const ADMIN_TABS = [["membres", "Membres"], ["roles", "Rôles & accès"], ["resa", "Réservations"], ["cours", "Cours"], ["phystests", "Tests physiques"], ["gamezone", "GameZone"], ["caisse", "Caisse"], ["stages", "Stages"], ["stats", "Statistiques"]];
const ROLE_LIST = [["superadmin", "Superadmin"], ["admin", "Admin"], ["secretaire", "Secrétaire"], ["head_coach", "Head coach"], ["coach", "Coach"], ["organisateur", "Official"], ["responsable", "Responsable"]];
const ASSIGNABLE_ROLES = ["superadmin", "admin", "secretaire", "head_coach", "coach", "membre", "organisateur", "responsable"];
// Rôles/tags d'une personne (cumulables) — pilotent filtres + onglets de la fiche.
const PERSON_ROLES = [
  ["membre", "Membre"], ["client", "Client"], ["coach", "Coach"], ["coach-prive", "Coach avec autorisation"],
  ["head-coach", "Head coach"], ["official", "Official"], ["responsable-tournoi", "Responsable tournoi"],
  ["kidstennis", "KidsTennis"], ["club", "Club"], ["competition", "Compétition"], ["performance", "Performance"],
  ["sport-etudes", "Sport-études"], ["pro-u18", "Pro U18"], ["pro", "Pro"],
  ["secretaire", "Secrétaire"], ["finance", "Finance"], ["admin", "Admin"], ["superadmin", "Superadmin"],
];
const roleLabel = (r) => (PERSON_ROLES.find(([v]) => v === r) || [r, r])[1];

// ---- Rôles saisonniers (source de vérité = table role_periods, par saison) ----
const SEASONAL_COTISATION = ["membre"];
const SEASONAL_JUNIORS = ["kidstennis", "club", "competition", "performance", "sport-etudes", "pro-u18", "pro"];
const SEASONAL_ROLES = [...SEASONAL_COTISATION, ...SEASONAL_JUNIORS];
const seasonTypeOf = (role) => SEASONAL_COTISATION.includes(role) ? "cotisation" : SEASONAL_JUNIORS.includes(role) ? "juniors" : null;
const INTENTS = [["reste", "Reste"], ["monte", "Monte"], ["descend", "Descend"], ["part", "Part"], ["a-decider", "À décider"]];
const intentLabel = (v) => (INTENTS.find(([x]) => x === v) || ["", "—"])[1];
// Saisons = table `seasons` (créées explicitement dans Réglages › Saisons).
let seasons = [];
async function loadSeasonsList() {
  const { data } = await sb.from("seasons").select("*").order("start_date", { ascending: false });
  seasons = data || [];
}
const seasonsOf = (kind) => seasons.filter((s) => s.kind === kind);
function currentSeason(kind) {
  const today = new Date().toISOString().slice(0, 10);
  const list = seasonsOf(kind);
  return list.find((s) => s.start_date <= today && today <= s.end_date)
    || list.filter((s) => s.start_date <= today)[0] || null; // list est triée desc
}

let peopleRoles = {};            // person_id -> [role,…]
const activeFilters = new Set(); // filtres rôle actifs

const tabAccessMap = () => settings.tab_access || DEFAULT_TAB_ACCESS;

function applyTabAccess(roles) {
  const access = tabAccessMap();
  // Onglets déjà configurés dans le réglage stocké (toutes rôles confondus).
  // Un onglet NON connu (nouveau module) retombe sur l'accès par défaut,
  // pour apparaître sans devoir re-régler la matrice à chaque ajout.
  const known = new Set(Object.values(access).flat());
  const allowedFor = (v) => roles.some((r) =>
    (known.has(v) ? (access[r] || []) : (DEFAULT_TAB_ACCESS[r] || [])).includes(v));
  let first = null;
  document.querySelectorAll(".side-item[data-view]").forEach((b) => {
    const v = b.dataset.view;
    if (v === "bientot") return;
    const allowed = allowedFor(v);
    b.classList.toggle("hidden", !allowed);
    if (allowed && !first) first = v;
  });
  if (first) showView(first);
}

async function init(roles) {
  $("logout").addEventListener("click", async () => {
    await sb.auth.signOut();
    location.href = "index.html";
  });
  $("new-person").addEventListener("click", () => openPerson(null));
  $("import-people").addEventListener("click", openImport);
  $("import-close").addEventListener("click", () => $("import-modal").classList.add("hidden"));
  $("import-modal").addEventListener("click", (e) => { if (e.target === $("import-modal")) $("import-modal").classList.add("hidden"); });
  $("import-template").addEventListener("click", downloadTemplate);
  $("import-file-btn").addEventListener("click", () => $("import-file").click());
  $("import-file").addEventListener("change", onImportFile);
  $("import-confirm").addEventListener("click", confirmImport);
  // La fiche s'affiche en pleine page : on déplace le <form> dans #people-detail
  $("people-detail").appendChild($("person-form"));
  $("close-person").addEventListener("click", closePerson);
  $("person-form").addEventListener("submit", savePerson);
  $("delete-person").addEventListener("click", deletePerson);
  $("invite-person").addEventListener("click", invitePerson);
  $("fam-add-btn").addEventListener("click", addFamily);
  $("cr-add-btn").addEventListener("click", rechargeCredit);
  document.querySelectorAll("#p-tabs .ptab").forEach((b) =>
    b.addEventListener("click", () => setPersonTab(b.dataset.ptab)));
  $("obj-add-btn").addEventListener("click", addObjective);
  $("ss-cot-add").addEventListener("click", () => addSeasonRole("cotisation", "membre"));
  $("ss-jun-add").addEventListener("click", () => addSeasonRole("juniors", $("ss-jun-role").value));
  $("media-btn").addEventListener("click", () => $("media-file").click());
  $("media-file").addEventListener("change", (e) => uploadMedia(e.target));
  $("p-photo-btn").addEventListener("click", () => $("p-photo-file").click());
  $("p-photo-file").addEventListener("change", () => uploadPersonPhoto($("p-photo-file")));
  $("search").addEventListener("input", renderRows);
  document.querySelectorAll(".side-item[data-view]").forEach((b) =>
    b.addEventListener("click", () => showView(b.dataset.view)));
  $("rg-save").addEventListener("click", saveSettings);
  $("gz-mov-add").addEventListener("click", addMovement);
  await loadSettings();
  applyTabAccess(roles);
  loadPeople();
  initResa(roles);
  initStats();
  initRoles();
  initCours(roles);
  initGameZone(roles);
  initStages();
  initPhys();
}

// ---- Bascule de vues ----
function showView(view) {
  if (view === "bientot") return;
  document.querySelectorAll(".side-item[data-view]").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach((v) =>
    v.classList.toggle("hidden", v.id !== "view-" + view));
  if (view === "caisse") loadCaisseTab();
  if (view === "stages") loadStagesTab();
  if (view === "phystests") loadPhysResults();
}

// ===================================================================
//  Réglages (app_settings)
// ===================================================================
let settings = {};
const PRICE_ZONES = [["hiver", "Hiver (bulle + halle)"], ["ete_ext", "Été (extérieurs)"], ["ete_halle", "Été (halle)"]];
const PRICE_CATS = [["m_m", "M/M"], ["second", "2ᵉ h"], ["m_guest", "M/invité"], ["ext", "Externe"]];

async function loadSettings() {
  const { data } = await sb.from("app_settings").select("key,value");
  settings = {};
  for (const r of data || []) settings[r.key] = r.value;

  const s = settings.season || {};
  $("rg-winter-start").value = s.winter_start || "";
  $("rg-winter-end").value = s.winter_end || "";
  updateWeeks();
  $("rg-winter-start").addEventListener("change", updateWeeks);
  $("rg-winter-end").addEventListener("change", updateWeeks);

  const q = settings.quotas || {};
  $("rg-max-m").value = q.max_hours_member ?? 2;
  $("rg-max-nm").value = q.max_hours_nonmember ?? 2;
  $("rg-max-coach").value = q.max_hours_coach == null ? "" : q.max_hours_coach;
  $("rg-inv").value = q.invitations_per_season_member ?? 2;
  $("rg-adv-m").value = q.advance_days_member ?? 7;
  $("rg-adv-nm").value = q.advance_days_nonmember ?? 2;
  $("rg-adv-coach").value = q.advance_days_coach ?? 14;

  const v = settings.visibility || {};
  $("rg-names-member").checked = v.show_names_to_member ?? true;
  $("rg-names-client").checked = v.show_names_to_client ?? false;

  const m = settings.confirmation_email || {};
  $("rg-mail-subject").value = m.subject || "";
  $("rg-mail-body").value = m.body || "";

  renderPricing();
}

function updateWeeks() {
  const a = $("rg-winter-start").value, b = $("rg-winter-end").value;
  if (!a || !b) { $("rg-weeks").textContent = ""; return; }
  const days = (new Date(b) - new Date(a)) / 86400000;
  const weeks = Math.round(days / 7 * 10) / 10;
  $("rg-weeks").textContent = days > 0 ? `≈ ${weeks} semaines` : "dates invalides";
}

function renderPricing() {
  const p = settings.pricing || {};
  let html = '<table class="crm-table"><thead><tr><th>Zone</th><th>Tarif</th>' +
    PRICE_CATS.map(([, l]) => `<th>${l}</th>`).join("") + "</tr></thead><tbody>";
  for (const [zk, zl] of PRICE_ZONES) {
    for (const rk of ["creuse", "pleine"]) {
      html += `<tr><td>${rk === "creuse" ? zl : ""}</td><td>${rk === "creuse" ? "Creuse" : "Pleine"}</td>` +
        PRICE_CATS.map(([ck]) =>
          `<td><input type="number" class="rg-price" data-z="${zk}" data-r="${rk}" data-c="${ck}" min="0"
            value="${p?.[zk]?.[rk]?.[ck] ?? 0}" style="width:64px" /></td>`).join("") + "</tr>";
    }
  }
  $("rg-pricing").innerHTML = html + "</tbody></table>";
}

async function saveSettings() {
  const pricing = {};
  for (const [zk] of PRICE_ZONES) { pricing[zk] = { creuse: {}, pleine: {} }; }
  document.querySelectorAll(".rg-price").forEach((i) => {
    pricing[i.dataset.z][i.dataset.r][i.dataset.c] = Number(i.value);
  });
  const rows = [
    { key: "season", value: { winter_start: $("rg-winter-start").value, winter_end: $("rg-winter-end").value } },
    { key: "quotas", value: {
      max_hours_member: Number($("rg-max-m").value), max_hours_nonmember: Number($("rg-max-nm").value),
      max_hours_coach: $("rg-max-coach").value === "" ? null : Number($("rg-max-coach").value),
      invitations_per_season_member: Number($("rg-inv").value),
      advance_days_member: Number($("rg-adv-m").value), advance_days_nonmember: Number($("rg-adv-nm").value),
      advance_days_coach: Number($("rg-adv-coach").value) } },
    { key: "visibility", value: { show_names_to_member: $("rg-names-member").checked, show_names_to_client: $("rg-names-client").checked } },
    { key: "confirmation_email", value: { subject: $("rg-mail-subject").value, body: $("rg-mail-body").value } },
    { key: "pricing", value: pricing },
  ];
  $("rg-status").textContent = "Enregistrement…";
  const { error } = await sb.from("app_settings").upsert(rows, { onConflict: "key" });
  $("rg-status").textContent = error ? "Erreur : " + error.message : "✓ Réglages enregistrés";
}

// ===================================================================
//  Réservations (staff) — grille, création/édition, récurrence
// ===================================================================
let resaCourts = [];      // courts affichés (selon saison de la date)
let resaCourtsAll = [];   // tous les courts actifs (pour le select)
let resaLabels = [];
let drag = null;

const isoA = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function seasonA(iso) {
  const s = settings.season || { winter_start: "2026-10-19", winter_end: "2027-04-11" };
  const md = (d) => Number(d.slice(5, 7)) * 100 + Number(d.slice(8, 10));
  const x = md(iso), a = md(s.winter_start), b = md(s.winter_end);
  return (x >= a || x <= b) ? "hiver" : "ete";
}

async function initResa(roles) {
  // Sous-onglets Jour / Réglages ; les Réglages sont réservés aux admins.
  const isAdminUser = (roles || []).some((r) => ["superadmin", "admin"].includes(r));
  if (!isAdminUser) document.querySelector('#view-resa .resa-subtab[data-sub="reglages"]')?.classList.add("hidden");
  document.querySelectorAll("#view-resa .resa-subtab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#view-resa .resa-subtab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("#view-resa .resa-sub").forEach((s) => s.classList.toggle("hidden", s.id !== "resa-sub-" + b.dataset.sub));
    }));

  const { data } = await sb.from("courts").select("*").eq("is_active", true).order("display_order");
  resaCourtsAll = data || [];
  $("r-court").innerHTML = resaCourtsAll.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  $("r-start").innerHTML = Array.from({ length: 14 }, (_, i) => i + 8)
    .map((h) => `<option value="${h}">${pad2(h)}:15</option>`).join("");
  await loadResaLabels();

  $("resa-date").value = isoA(new Date());
  $("resa-date").addEventListener("change", loadResaDay);
  $("resa-prev").addEventListener("click", () => shiftResa(-1));
  $("resa-next").addEventListener("click", () => shiftResa(1));
  $("resa-today").addEventListener("click", () => { $("resa-date").value = isoA(new Date()); loadResaDay(); });
  $("resa-close").addEventListener("click", closeResa);
  $("resa-modal").addEventListener("click", (e) => { if (e.target === $("resa-modal")) closeResa(); });
  $("resa-form").addEventListener("submit", saveResa);
  $("r-del-occ").addEventListener("click", deleteOccurrence);
  $("r-del-series").addEventListener("click", deleteSeries);
  document.addEventListener("mouseup", endDrag);
  loadResaDay();
}

async function loadResaLabels() {
  const { data } = await sb.from("booking_labels").select("*").order("name");
  resaLabels = data || [];
  $("label-list").innerHTML = resaLabels.map((l) => `<option value="${esc(l.name)}">`).join("");
}

function shiftResa(delta) {
  const d = new Date($("resa-date").value + "T00:00:00");
  d.setDate(d.getDate() + delta);
  $("resa-date").value = isoA(d);
  loadResaDay();
}

async function loadResaDay() {
  const date = $("resa-date").value;
  const season = seasonA(date);
  const sunIco = '<svg class="season-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.4M12 19.1v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7"/></svg>';
  const snowIco = '<svg class="season-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M3.4 7l17.2 10M20.6 7L3.4 17"/><path d="M12 5l-2.2 2.2M12 5l2.2 2.2M12 19l-2.2-2.2M12 19l2.2 2.2"/></svg>';
  $("resa-season").innerHTML = season === "ete" ? sunIco + "Été" : snowIco + "Hiver";
  const col = season === "ete" ? "open_summer" : "open_winter";
  resaCourts = resaCourtsAll.filter((c) => c[col]);
  const { data: bookings } = await sb.from("court_bookings").select("*").eq("booking_date", date);
  // Pour les cours : on récupère les coachs (affichés à la place du type dans la grille)
  const courseIds = [...new Set((bookings || []).filter((b) => b.course_id).map((b) => b.course_id))];
  const coachMap = {};
  if (courseIds.length) {
    const { data: cc } = await sb.from("course_coaches").select("course_id,coach_person_id").in("course_id", courseIds);
    for (const x of cc || []) (coachMap[x.course_id] = coachMap[x.course_id] || []).push(x.coach_person_id);
  }
  drawResaGrid(date, bookings || [], coachMap);
}

function drawResaGrid(date, bookings, coachMap = {}) {
  const grid = $("resa-grid");
  grid.style.gridTemplateColumns = `64px repeat(${resaCourts.length}, minmax(74px,1fr))`;
  grid.innerHTML = "";
  grid.appendChild(rcell("", "rcell corner"));
  for (const c of resaCourts) {
    const el = document.createElement("div");
    el.className = "rcell rhead " + surfaceClass(c.surface);
    const n = c.name.replace("Court ", "");
    el.innerHTML = `<span class="cn-full">Court&nbsp;${n}</span><span class="cn-short">${n}</span>`;
    el.title = `${c.name} · ${c.surface}`;
    grid.appendChild(el);
  }

  for (let h = 8; h <= 21; h++) {
    grid.appendChild(rcell(pad2(h) + ":15", "rcell rhour"));
    for (const c of resaCourts) {
      const slotStart = pad2(h) + ":15:00", slotEnd = pad2(h + 1) + ":15:00";
      const b = bookings.find((x) => x.court_id === c.id && x.start_time < slotEnd && x.end_time > slotStart);
      const el = document.createElement("div");
      el.className = "rcell rslot";
      if (b) {
        el.style.background = b.color || "#1e3ad1";
        el.style.color = "#fff";
        // Pour un cours : nom du/des coach(s) (le type est déjà donné par la couleur)
        const cids = b.course_id ? (coachMap[b.course_id] || []) : [];
        let label, full;
        if (cids.length) {
          const p0 = people.find((x) => x.id === cids[0]);
          label = (p0 ? p0.last_name : "Coach") + (cids.length > 1 ? ` +${cids.length - 1}` : "");
          full = cids.map((id) => personName(id)).join(", ");
        } else {
          label = b.title || kindLabel(b.kind);
          full = label;
        }
        el.textContent = label;
        el.title = full + (b.recurrence_id ? " · série" : "");
        el.addEventListener("click", () => editBooking(b, h));
      } else {
        el.classList.add("rfree");
        el.dataset.court = c.id;
        el.dataset.hour = h;
        el.addEventListener("mousedown", (e) => { e.preventDefault(); startDrag(c.id, h); });
        el.addEventListener("mouseover", () => overDrag(c.id, h));
      }
      grid.appendChild(el);
    }
  }
}

const kindLabel = (k) => ({ cours: "Cours", tournoi: "Tournoi", maintenance: "Maintenance", libre: "Réservé" }[k] || "Réservé");
function rcell(text, cls) { const el = document.createElement("div"); el.className = cls; el.textContent = text; return el; }
function surfaceClass(s) { return /terre/i.test(s) ? "sfc-terre" : /gazon|synth/i.test(s) ? "sfc-gazon" : "sfc-dur"; }

// ---- Sélection à la souris ----
function startDrag(court, h) { drag = { court, h1: h, h2: h }; paintDrag(); }
function overDrag(court, h) { if (drag && drag.court === court) { drag.h2 = h; paintDrag(); } }
function paintDrag() {
  document.querySelectorAll("#resa-grid .rslot.sel").forEach((e) => e.classList.remove("sel"));
  if (!drag) return;
  const lo = Math.min(drag.h1, drag.h2), hi = Math.max(drag.h1, drag.h2);
  document.querySelectorAll(`#resa-grid .rslot[data-court="${drag.court}"]`).forEach((e) => {
    const h = Number(e.dataset.hour);
    if (h >= lo && h <= hi) e.classList.add("sel");
  });
}
function endDrag() {
  if (!drag) return;
  const lo = Math.min(drag.h1, drag.h2), hi = Math.max(drag.h1, drag.h2);
  const court = drag.court;
  drag = null;
  document.querySelectorAll("#resa-grid .rslot.sel").forEach((e) => e.classList.remove("sel"));
  openResaCreate(court, lo, hi - lo + 1);
}

// ---- Création / édition ----
function openResaCreate(courtId, hour, dur) {
  $("r-error").hidden = true;
  $("resa-title").textContent = "Nouvelle réservation";
  $("r-id").value = ""; $("r-recid").value = "";
  $("r-name").value = ""; $("r-kind").value = "cours";
  $("r-court").value = courtId ?? resaCourtsAll[0]?.id;
  $("r-date").value = $("resa-date").value;
  $("r-start").value = hour ?? 8;
  $("r-dur").value = dur ?? 1;
  $("r-color").value = "#1e3ad1";
  $("r-rec").checked = false; $("r-until").value = "";
  $("r-del-occ").classList.add("hidden");
  $("r-del-series").classList.add("hidden");
  $("resa-modal").classList.remove("hidden");
}

function editBooking(b, hour) {
  // Un cours : on ouvre l'éditeur de cours complet (coachs, élèves, présences)
  if (b.course_id && isHeadUser) { editCourse(b.course_id); return; }
  $("r-error").hidden = true;
  $("resa-title").textContent = "Modifier la réservation";
  $("r-id").value = b.id; $("r-recid").value = b.recurrence_id || "";
  $("r-name").value = b.title || "";
  $("r-kind").value = b.kind || "cours";
  $("r-court").value = b.court_id;
  $("r-date").value = b.booking_date;
  $("r-start").value = Number(b.start_time.slice(0, 2));
  $("r-dur").value = Number(b.end_time.slice(0, 2)) - Number(b.start_time.slice(0, 2));
  $("r-color").value = b.color || "#1e3ad1";
  $("r-rec").checked = false; $("r-until").value = "";
  $("r-del-occ").classList.remove("hidden");
  $("r-del-series").classList.toggle("hidden", !b.recurrence_id);
  $("resa-modal").classList.remove("hidden");
}

function closeResa() { $("resa-modal").classList.add("hidden"); }

async function saveResa(e) {
  e.preventDefault();
  const err = $("r-error"); err.hidden = true;
  const name = $("r-name").value.trim();
  const kind = $("r-kind").value;
  const courtId = Number($("r-court").value);
  const date = $("r-date").value;
  const startH = Number($("r-start").value);
  const dur = Number($("r-dur").value);
  const color = $("r-color").value;
  if (startH + dur > 22) return failR(err, "La durée dépasse la fin de journée (22:15 max).");

  const base = {
    court_id: courtId, start_time: pad2(startH) + ":15:00", end_time: pad2(startH + dur) + ":15:00",
    kind, title: name || null, color, created_by: meId,
  };

  const id = $("r-id").value;
  if (id) {
    const { error } = await sb.from("court_bookings").update({ ...base, booking_date: date }).eq("id", id);
    if (error) return failR(err, error.message);
  } else if ($("r-rec").checked && $("r-until").value) {
    const recId = crypto.randomUUID();
    let d = new Date(date + "T00:00:00");
    const end = new Date($("r-until").value + "T00:00:00");
    let ok = 0, conflicts = 0;
    while (d <= end) {
      const { error } = await sb.from("court_bookings").insert({ ...base, booking_date: isoA(d), recurrence_id: recId });
      if (error) conflicts++; else ok++;
      d.setDate(d.getDate() + 7);
    }
    if (ok === 0) return failR(err, "Aucune date libre pour cette série.");
    if (conflicts) alert(`${ok} créneaux créés, ${conflicts} déjà occupés (ignorés).`);
  } else {
    const { error } = await sb.from("court_bookings").insert({ ...base, booking_date: date });
    if (error) return failR(err, error.code === "23P01" ? "Ce créneau est déjà pris." : error.message);
  }

  if (name && !resaLabels.some((l) => l.name === name)) {
    await sb.from("booking_labels").insert({ name, color });
    await loadResaLabels();
  }
  closeResa();
  loadResaDay();
}

async function deleteOccurrence() {
  const id = $("r-id").value;
  if (!id || !confirm("Supprimer cette réservation ?")) return;
  await sb.from("court_bookings").delete().eq("id", id);
  closeResa(); loadResaDay();
}
async function deleteSeries() {
  const rec = $("r-recid").value;
  if (!rec || !confirm("Supprimer TOUTE la série récurrente ?")) return;
  await sb.from("court_bookings").delete().eq("recurrence_id", rec);
  closeResa(); loadResaDay();
}
function failR(el, msg) { el.textContent = msg; el.hidden = false; }

// ===================================================================
//  Statistiques
// ===================================================================
const WD = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function initStats() {
  const today = isoA(new Date());
  $("st-to").value = today;
  $("st-from").value = today.slice(0, 4) + "-01-01";
  $("st-refresh").addEventListener("click", loadStats);
  $("st-all").addEventListener("click", () => { $("st-from").value = "2026-01-01"; loadStats(); });
  loadStats();
}

function weekKey(iso) {
  const d = new Date(iso + "T00:00:00");
  const day = (d.getDay() + 6) % 7;              // 0 = lundi
  d.setDate(d.getDate() - day + 3);              // jeudi de la semaine ISO
  const firstThu = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-S${pad2(week)}`;
}

async function loadStats() {
  const from = $("st-from").value, to = $("st-to").value;
  const { data } = await sb.from("court_bookings").select("*")
    .gte("booking_date", from).lte("booking_date", to);
  const bookings = data || [];
  $("st-empty").hidden = bookings.length > 0;

  const hoursOf = (b) => Number(b.end_time.slice(0, 2)) - Number(b.start_time.slice(0, 2));
  const players = { m_m: 0, m_guest: 0, ext: 0, club: 0, autre: 0 };
  const byCourt = {}, byHour = {}, byWeekday = {}, byWeek = {}, byDayChf = {};
  let totalHours = 0, totalChf = 0;

  for (const b of bookings) {
    const h = hoursOf(b); totalHours += h;
    totalChf += Number(b.price_chf || 0);
    if (["cours", "tournoi", "maintenance"].includes(b.kind)) players.club += h;
    else if (b.payer_category === "m_m") players.m_m += h;
    else if (b.payer_category === "m_guest") players.m_guest += h;
    else if (b.payer_category === "ext") players.ext += h;
    else players.autre += h;
    byCourt[b.court_id] = (byCourt[b.court_id] || 0) + h;
    const sh = Number(b.start_time.slice(0, 2));
    for (let k = 0; k < h; k++) byHour[sh + k] = (byHour[sh + k] || 0) + 1;
    const wd = ((new Date(b.booking_date + "T00:00:00").getDay()) + 6) % 7 + 1;
    byWeekday[wd] = (byWeekday[wd] || 0) + h;
    const wk = weekKey(b.booking_date); byWeek[wk] = (byWeek[wk] || 0) + h;
    byDayChf[b.booking_date] = (byDayChf[b.booking_date] || 0) + Number(b.price_chf || 0);
  }

  // taux d'occupation sur la période
  let available = 0;
  const d0 = new Date(from + "T00:00:00"), d1 = new Date(to + "T00:00:00");
  for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
    const iso = isoA(d), season = seasonA(iso), col = season === "ete" ? "open_summer" : "open_winter";
    available += resaCourtsAll.filter((c) => c[col]).length * 14;
  }
  const occ = available ? Math.round(totalHours / available * 100) : 0;

  // KPI
  $("st-kpis").innerHTML =
    kpi("Réservations", bookings.length) + kpi("Heures jouées", totalHours) +
    kpi("Recettes", totalChf.toFixed(0) + " CHF") + kpi("Taux d'occupation", occ + " %");

  // Type de joueur
  const pl = [["Membre / membre", players.m_m], ["Membre + invité", players.m_guest],
    ["Non-membre", players.ext], ["Club (cours, tournois…)", players.club]];
  if (players.autre) pl.push(["Autre", players.autre]);
  $("st-players").innerHTML = barsFrom(pl, "h");

  // Occupation par court
  const courtRows = resaCourtsAll.map((c) => [c.name, byCourt[c.id] || 0]);
  $("st-courts").innerHTML = barsFrom(courtRows, "h");

  // Par heure
  const hourRows = [];
  for (let hh = 8; hh <= 21; hh++) hourRows.push([pad2(hh) + "h", byHour[hh] || 0]);
  $("st-hours").innerHTML = barsFrom(hourRows, "");

  // Par jour de semaine
  const wdRows = [];
  for (let w = 1; w <= 7; w++) wdRows.push([WD[w], byWeekday[w] || 0]);
  $("st-weekdays").innerHTML = barsFrom(wdRows, "h");

  // Recettes par jour (les 14 derniers jours non nuls)
  const revRows = Object.entries(byDayChf).sort().slice(-14).map(([d, v]) => [d.slice(5), v.toFixed(0)]);
  $("st-revenue").innerHTML = revRows.length ? barsFrom(revRows, " CHF") : '<p class="muted">—</p>';

  // Semaine la plus demandée
  const top = Object.entries(byWeek).sort((a, b) => b[1] - a[1])[0];
  $("st-topweek").innerHTML = top
    ? `<b>${top[0]}</b><span>${top[1]} heures réservées</span>`
    : '<span class="muted">—</span>';
}

function kpi(label, val) {
  return `<div class="kpi"><b>${val}</b><span>${label}</span></div>`;
}
function barsFrom(rows, suffix) {
  const max = Math.max(1, ...rows.map((r) => Number(r[1])));
  return rows.map(([label, val]) =>
    `<div class="bar-row"><span class="bar-label">${label}</span>
      <div class="bar"><div class="bar-fill" style="width:${Math.round(Number(val) / max * 100)}%"></div></div>
      <span class="bar-val">${val}${suffix}</span></div>`).join("");
}

// ===================================================================
//  Rôles & accès
// ===================================================================
function initRoles() {
  renderAccessMatrix();
  $("access-save").addEventListener("click", saveAccess);
  loadAccounts();
  document.querySelectorAll("#view-roles .rg-subtab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#view-roles .rg-subtab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("#view-roles .rg-sub").forEach((s) => s.classList.toggle("hidden", s.id !== "rg-sub-" + b.dataset.sub));
      if (b.dataset.sub === "seasons") loadSeasonsManage();
    }));
  $("rg-cot-add").addEventListener("click", () => addRoleSeason("cotisation"));
  $("rg-jun-add").addEventListener("click", () => addRoleSeason("juniors"));
}

async function loadSeasonsManage() {
  await loadSeasonsList();
  const render = (kind, containerId) => {
    const cur = currentSeason(kind);
    const list = seasonsOf(kind);
    $(containerId).innerHTML = list.length ? list.map((s) => `
      <div class="rg-season-row${cur && s.id === cur.id ? " ss-cur" : ""}" data-id="${s.id}">
        <input class="rgs-label" value="${esc(s.label)}" />
        <input type="date" class="rgs-start" value="${s.start_date}" />
        <span class="rgs-arrow">→</span>
        <input type="date" class="rgs-end" value="${s.end_date}" />
        ${cur && s.id === cur.id ? '<span class="ss-tag ss-ok">en cours</span>' : ""}
        <button type="button" class="ghost rgs-save">Enregistrer</button>
        <button type="button" class="fam-del rgs-del">✕</button>
      </div>`).join("") : '<p class="muted" style="font-size:.85rem">Aucune saison.</p>';
    $(containerId).querySelectorAll(".rg-season-row").forEach((row) => {
      row.querySelector(".rgs-save").addEventListener("click", () => saveRoleSeason(row));
      row.querySelector(".rgs-del").addEventListener("click", () => delRoleSeason(row.dataset.id));
    });
  };
  render("cotisation", "rg-cot-seasons");
  render("juniors", "rg-jun-seasons");
}
async function addRoleSeason(kind) {
  const p = kind === "cotisation" ? "cot" : "jun";
  const label = $(`rg-${p}-label`).value.trim();
  const start = $(`rg-${p}-start`).value, end = $(`rg-${p}-end`).value;
  if (!label || !start || !end) { alert("Étiquette + date de début + date de fin obligatoires."); return; }
  if (end < start) { alert("La date de fin précède le début."); return; }
  const { error } = await sb.from("seasons").insert({ kind, label, start_date: start, end_date: end });
  if (error) { alert(error.message); return; }
  $(`rg-${p}-label`).value = ""; $(`rg-${p}-start`).value = ""; $(`rg-${p}-end`).value = "";
  loadSeasonsManage();
  loadPeople();
}
async function saveRoleSeason(row) {
  const patch = {
    label: row.querySelector(".rgs-label").value.trim(),
    start_date: row.querySelector(".rgs-start").value,
    end_date: row.querySelector(".rgs-end").value,
  };
  if (!patch.label || !patch.start_date || !patch.end_date) { alert("Champs obligatoires."); return; }
  const btn = row.querySelector(".rgs-save"); btn.textContent = "…";
  const { error } = await sb.from("seasons").update(patch).eq("id", row.dataset.id);
  btn.textContent = error ? "Erreur" : "Enregistré ✓";
  if (!error) { await loadSeasonsList(); loadPeople(); }
  setTimeout(() => (btn.textContent = "Enregistrer"), 1500);
}
async function delRoleSeason(id) {
  if (!confirm("Supprimer cette saison ? (les affectations de cette saison seront aussi supprimées)")) return;
  const { error } = await sb.from("seasons").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  loadSeasonsManage();
  loadPeople();
}

function renderAccessMatrix() {
  const access = tabAccessMap();
  let html = '<table class="crm-table"><thead><tr><th>Rôle</th>' +
    ADMIN_TABS.map(([, l]) => `<th>${l}</th>`).join("") + "</tr></thead><tbody>";
  for (const [rk, rl] of ROLE_LIST) {
    html += `<tr><td>${rl}</td>` + ADMIN_TABS.map(([tk]) =>
      `<td style="text-align:center"><input type="checkbox" class="acc" data-role="${rk}" data-tab="${tk}" ${(access[rk] || []).includes(tk) ? "checked" : ""} /></td>`).join("") + "</tr>";
  }
  $("access-matrix").innerHTML = html + "</tbody></table>";
}

async function saveAccess() {
  const map = {};
  for (const [rk] of ROLE_LIST) map[rk] = [];
  document.querySelectorAll(".acc:checked").forEach((c) => map[c.dataset.role].push(c.dataset.tab));
  $("access-status").textContent = "Enregistrement…";
  const { error } = await sb.from("app_settings").upsert({ key: "tab_access", value: map }, { onConflict: "key" });
  if (error) { $("access-status").textContent = "Erreur : " + error.message; return; }
  settings.tab_access = map;
  $("access-status").textContent = "✓ Accès enregistrés (effectif à la prochaine connexion des utilisateurs)";
}

async function loadAccounts() {
  const { data, error } = await sb.rpc("list_accounts");
  if (error) { $("accounts-rows").innerHTML = `<tr><td colspan="2" class="muted">${esc(error.message)}</td></tr>`; return; }
  $("accounts-rows").innerHTML = (data || []).map((a) => {
    const label = a.person_name ? `${a.person_name} · ${a.email}` : a.email;
    const chips = ASSIGNABLE_ROLES.map((r) =>
      `<label class="role-chip"><input type="checkbox" data-uid="${a.user_id}" data-role="${r}" ${(a.roles || []).includes(r) ? "checked" : ""} /> ${r}</label>`).join("");
    return `<tr><td>${esc(label)}</td><td class="role-cell">${chips}</td></tr>`;
  }).join("");
  $("accounts-rows").querySelectorAll("input[type=checkbox]").forEach((c) =>
    c.addEventListener("change", () => toggleRole(c)));
}

async function toggleRole(c) {
  const { error } = await sb.rpc("set_user_role", { target: c.dataset.uid, r: c.dataset.role, enabled: c.checked });
  if (error) { alert("Erreur : " + error.message); c.checked = !c.checked; }
}

async function loadPeople() {
  await loadSeasonsList();
  const curIds = [currentSeason("cotisation"), currentSeason("juniors")].filter(Boolean).map((s) => s.id);
  const [{ data, error }, { data: pr }, { data: rp }] = await Promise.all([
    sb.from("people").select("*").order("last_name").order("first_name"),
    sb.from("person_roles").select("person_id,role"),
    curIds.length ? sb.from("role_periods").select("person_id,role,season_id").in("season_id", curIds) : Promise.resolve({ data: [] }),
  ]);
  if (error) { alert("Erreur chargement : " + error.message); return; }
  people = data || [];
  peopleRoles = {};
  const add = (pid, role) => { const a = (peopleRoles[pid] || (peopleRoles[pid] = [])); if (!a.includes(role)) a.push(role); };
  for (const r of pr || []) add(r.person_id, r.role);
  for (const r of rp || []) add(r.person_id, r.role); // rôles saisonniers de la saison EN COURS
  renderFilters();
  renderRows();
}

function renderFilters() {
  const box = $("people-filters"); if (!box) return;
  const all = `<button type="button" class="chip filt reset${activeFilters.size ? "" : " sel"}" data-role="">Tout</button>`;
  box.innerHTML = `<span class="filters-lbl">Filtrer&nbsp;:</span>` + all + PERSON_ROLES.map(([v, l]) =>
    `<button type="button" class="chip filt${activeFilters.has(v) ? " sel" : ""}" data-role="${v}">${esc(l)}</button>`).join("");
  box.querySelectorAll(".filt").forEach((b) => b.addEventListener("click", () => {
    const r = b.dataset.role;
    if (!r) activeFilters.clear();
    else activeFilters.has(r) ? activeFilters.delete(r) : activeFilters.add(r);
    renderFilters(); renderRows();
  }));
}

// ===================================================================
//  Import Excel / CSV des membres
// ===================================================================
const IMPORT_HEADERS = ["Prénom", "Nom", "Naissance", "Genre", "Email", "Téléphone", "AVS", "Adresse", "NPA", "Ville", "Rôles", "Notes"];
const norm = (s) => (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const HEADER_MAP = {
  prenom: "first", nom: "last", naissance: "birth", "date de naissance": "birth",
  genre: "gender", sexe: "gender", email: "email", "e-mail": "email", courriel: "email",
  telephone: "phone", tel: "phone", portable: "phone", natel: "phone",
  avs: "avs", "n avs": "avs", "no avs": "avs", "n° avs": "avs",
  adresse: "address", npa: "postal", "code postal": "postal", ville: "city",
  roles: "roles", role: "roles", notes: "notes", remarques: "notes", note: "notes",
};
// lookup rôle : par valeur OU par libellé
const ROLE_LOOKUP = (() => {
  const m = {};
  for (const [v, l] of PERSON_ROLES) { m[norm(v)] = v; m[norm(l)] = v; }
  m[norm("headcoach")] = "head-coach"; m[norm("coach prive")] = "coach-prive";
  m[norm("sport-etudes")] = "sport-etudes"; m[norm("sport etudes")] = "sport-etudes";
  m[norm("prou18")] = "pro-u18"; m[norm("pro u18")] = "pro-u18";
  return m;
})();
let importRows = [];

function importParseDate(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  if (typeof v === "number") { const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; }
  const s = v.toString().trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`;
  m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += y < 30 ? 2000 : 1900; return `${y}-${pad2(+m[2])}-${pad2(+m[1])}`; }
  return null;
}
function importParseGender(v) {
  const n = norm(v);
  if (["f", "femme", "fille", "féminin", "feminin"].includes(n)) return "F";
  if (["m", "homme", "garcon", "garçon", "masculin", "h"].includes(n)) return "M";
  if (n === "x" || n === "autre") return "X";
  return null;
}
function importParseRoles(v) {
  if (!v) return { ok: [], bad: [] };
  const parts = v.toString().split(/[,;|\/]+/).map((x) => x.trim()).filter(Boolean);
  const ok = [], bad = [];
  for (const p of parts) { const r = ROLE_LOOKUP[norm(p)]; if (r) { if (!ok.includes(r)) ok.push(r); } else bad.push(p); }
  return { ok, bad };
}
function openImport() {
  $("import-error").hidden = true;
  $("import-summary").hidden = true;
  $("import-preview").innerHTML = "";
  $("import-confirm").disabled = true;
  $("import-file").value = "";
  importRows = [];
  $("import-modal").classList.remove("hidden");
}
function downloadTemplate() {
  if (!window.XLSX) { alert("Le module Excel n'est pas encore chargé, réessayez dans un instant."); return; }
  const example = ["Zoé", "Dupont", "15.03.2014", "F", "zoe@example.com", "079 123 45 67", "", "Ch. du Tennis 1", "1006", "Lausanne", "kidstennis, competition", ""];
  const ws = XLSX.utils.aoa_to_sheet([IMPORT_HEADERS, example]);
  ws["!cols"] = IMPORT_HEADERS.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Membres");
  XLSX.writeFile(wb, "teamlausanne_membres_modele.xlsx");
}
async function onImportFile(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  $("import-error").hidden = true;
  if (!window.XLSX) { $("import-error").textContent = "Module Excel non chargé, réessayez."; $("import-error").hidden = false; return; }
  const buf = await f.arrayBuffer();
  let wb;
  try { wb = XLSX.read(buf, { type: "array", cellDates: true }); }
  catch (err) { $("import-error").textContent = "Lecture impossible : " + err.message; $("import-error").hidden = false; return; }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
  if (raw.length < 2) { $("import-error").textContent = "Le fichier semble vide (pas de lignes de données)."; $("import-error").hidden = false; return; }
  const headers = raw[0].map((h) => HEADER_MAP[norm(h)] || null);
  const existingEmails = new Set(people.map((p) => norm(p.email)).filter(Boolean));
  const existingNames = new Set(people.map((p) => norm(p.first_name) + "|" + norm(p.last_name)));
  importRows = raw.slice(1).map((cells) => {
    const o = { first: "", last: "", birth: null, gender: null, email: "", phone: "", avs: "", address: "", postal: "", city: "", roles: { ok: [], bad: [] }, notes: "" };
    headers.forEach((key, i) => {
      if (!key) return;
      const val = cells[i];
      if (key === "birth") o.birth = importParseDate(val);
      else if (key === "gender") o.gender = importParseGender(val);
      else if (key === "roles") o.roles = importParseRoles(val);
      else o[key] = (val == null ? "" : val.toString().trim());
    });
    const errs = [];
    if (!o.first || !o.last) errs.push("Prénom/Nom manquant");
    const dup = (o.email && existingEmails.has(norm(o.email))) || existingNames.has(norm(o.first) + "|" + norm(o.last));
    o._errs = errs; o._dup = dup;
    return o;
  }).filter((o) => o.first || o.last || o.email); // ignore lignes totalement vides
  renderImportPreview();
}
function renderImportPreview() {
  const valid = importRows.filter((o) => o._errs.length === 0);
  const dups = valid.filter((o) => o._dup).length;
  const bad = importRows.length - valid.length;
  const badRoles = [...new Set(importRows.flatMap((o) => o.roles.bad))];
  const s = $("import-summary");
  s.hidden = false;
  s.innerHTML = `<b>${valid.length}</b> fiche(s) prête(s) à importer`
    + (bad ? ` · <span class="imp-warn">${bad} ignorée(s)</span>` : "")
    + (dups ? ` · <span class="imp-warn">${dups} doublon(s) possible(s)</span>` : "")
    + (badRoles.length ? `<br><span class="imp-warn">Rôles non reconnus (ignorés) : ${esc(badRoles.join(", "))}</span>` : "");
  const rowsHtml = importRows.slice(0, 40).map((o) => {
    const st = o._errs.length ? `<span class="imp-bad">${esc(o._errs.join(", "))}</span>`
      : o._dup ? `<span class="imp-warn">doublon ?</span>` : `<span class="imp-ok">OK</span>`;
    return `<tr class="${o._errs.length ? "imp-row-bad" : ""}"><td>${esc(o.first)}</td><td>${esc(o.last)}</td>
      <td>${frDate(o.birth)}</td><td>${esc(o.email)}</td>
      <td>${o.roles.ok.map((r) => `<span class="role-badge">${esc(roleLabel(r))}</span>`).join(" ")}</td>
      <td>${st}</td></tr>`;
  }).join("");
  $("import-preview").innerHTML = `<div class="table-wrap"><table class="crm-table"><thead><tr>
    <th>Prénom</th><th>Nom</th><th>Naissance</th><th>Email</th><th>Rôles</th><th>Statut</th></tr></thead>
    <tbody>${rowsHtml}</tbody></table></div>`
    + (importRows.length > 40 ? `<p class="muted" style="font-size:.82rem">… et ${importRows.length - 40} autre(s) ligne(s).</p>` : "");
  $("import-confirm").disabled = valid.length === 0;
  $("import-confirm").textContent = `Importer ${valid.length} fiche(s)`;
}
async function confirmImport() {
  const valid = importRows.filter((o) => o._errs.length === 0);
  if (!valid.length) return;
  const btn = $("import-confirm"); btn.disabled = true;
  let done = 0, fail = 0;
  for (const o of valid) {
    btn.textContent = `Import… ${done + 1}/${valid.length}`;
    const row = {
      first_name: o.first, last_name: o.last, birthdate: o.birth, gender: o.gender,
      email: o.email || null, phone: o.phone || null, avs: o.avs || null,
      address: o.address || null, postal_code: o.postal || null, city: o.city || null,
      notes: o.notes || null, is_active: true,
    };
    const res = await sb.from("people").insert(row).select("id").single();
    if (res.error) { fail++; continue; }
    if (o.roles.ok.length) {
      await sb.from("person_roles").insert(o.roles.ok.map((role) => ({ person_id: res.data.id, role })));
    }
    done++;
  }
  $("import-modal").classList.add("hidden");
  await loadPeople();
  alert(`✓ ${done} fiche(s) importée(s)` + (fail ? `\n${fail} échec(s).` : ""));
}

function renderRows() {
  const q = $("search").value.trim().toLowerCase();
  const rows = people.filter((p) => {
    const roles = peopleRoles[p.id] || [];
    if (activeFilters.size && ![...activeFilters].every((f) => roles.includes(f))) return false;
    if (!q) return true;
    const emails = [p.email, ...(p.emails || [])].join(" ");
    const phones = [p.phone, ...(p.phones || [])].join(" ");
    return (`${p.first_name} ${p.last_name} ${emails} ${phones}`).toLowerCase().includes(q);
  });
  const tbody = $("people-rows");
  tbody.innerHTML = "";
  $("empty-msg").hidden = rows.length > 0;
  for (const p of rows) {
    const emails = [p.email, ...(p.emails || [])].filter(Boolean);
    const phones = [p.phone, ...(p.phones || [])].filter(Boolean);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(p.last_name)}</td>
      <td>${esc(p.first_name)}</td>
      <td>${esc(emails[0] || "")}${emails.length > 1 ? ` <span class="muted">+${emails.length - 1}</span>` : ""}</td>
      <td>${esc(phones[0] || "")}${phones.length > 1 ? ` <span class="muted">+${phones.length - 1}</span>` : ""}</td>
      <td>${frDate(p.birthdate)}</td>`;
    tr.addEventListener("click", () => openPerson(p));
    tbody.appendChild(tr);
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---- Fiche ----
function openPerson(p) {
  $("person-error").hidden = true;
  $("person-title").textContent = p ? "Modifier la fiche" : "Nouvelle personne";
  $("delete-person").classList.toggle("hidden", !p);
  $("invite-person").classList.toggle("hidden", !p);
  $("p-id").value = p?.id || "";
  $("p-first").value = p?.first_name || "";
  $("p-last").value = p?.last_name || "";
  $("p-birth").value = p?.birthdate || "";
  $("p-gender").value = p?.gender || "";
  $("p-email").value = p?.email || "";
  $("p-phone").value = p?.phone || "";
  $("p-avs").value = p?.avs || "";
  $("p-emails").value = (p?.emails || []).join("\n");
  $("p-phones").value = (p?.phones || []).join("\n");
  $("p-address").value = p?.address || "";
  $("p-postal").value = p?.postal_code || "";
  $("p-city").value = p?.city || "";
  $("p-bexio").value = p?.bexio_contact_id || "";
  $("p-active").checked = p ? p.is_active : true;
  $("p-notes").value = p?.notes || "";
  personPhotoUrl = p?.photo_url || null;
  renderPersonPhoto();
  renderPersonRoles(p ? (peopleRoles[p.id] || []) : []);
  $("family-section").classList.toggle("hidden", !p);
  $("credit-section").classList.toggle("hidden", !p);
  if (p) { populateFamPersons(p.id); loadFamily(p.id); loadCredit(p.id); }
  const roles = p ? (peopleRoles[p.id] || []) : [];
  // Onglet Réservations : visible si membre/client (ou si des résas existent — persistance)
  const resaByRole = roles.includes("membre") || roles.includes("client");
  const coursByRole = COURSE_ROLES.some((r) => roles.includes(r));
  showPersonTab("resa", resaByRole);
  showPersonTab("cours", coursByRole);
  setPersonTab("info");
  loadObjectives(p ? p.id : null);
  loadMedia(p ? p.id : null);
  loadPersonSeasons(p ? p.id : null);
  if (p) { loadReservations(p.id, resaByRole); loadCourses(p.id, coursByRole); }
  else { $("resa-list").innerHTML = ""; $("resa-stats").innerHTML = ""; $("cours-content").innerHTML = ""; }
  $("people-list-wrap").classList.add("hidden");
  $("people-detail").classList.remove("hidden");
  window.scrollTo(0, 0);
}

// ---- Onglets de la fiche ----
function setPersonTab(tab) {
  document.querySelectorAll("#p-tabs .ptab").forEach((b) =>
    b.classList.toggle("active", b.dataset.ptab === tab));
  document.querySelectorAll("#person-form .ptab-panel").forEach((p) =>
    p.classList.toggle("hidden", p.id !== `ptab-${tab}`));
}
function showPersonTab(tab, show) {
  const btn = document.querySelector(`#p-tabs .ptab[data-ptab="${tab}"]`);
  if (btn) btn.classList.toggle("hidden", !show);
}

// Rôles qui font apparaître l'onglet Cours
const COURSE_ROLES = ["kidstennis", "club", "competition", "performance", "sport-etudes", "pro-u18", "pro"];
const COACH_ROLES = ["coach", "head-coach", "coach-prive"];
const hasRoleIn = (pid, list) => (peopleRoles[pid] || []).some((r) => list.includes(r));

// ---- Photos / vidéos d'une personne ----
async function loadMedia(personId) {
  const grid = $("media-grid");
  const has = !!personId;
  $("media-btn").disabled = !has;
  $("media-need-save").hidden = has;
  $("media-status").textContent = "";
  if (!has) { grid.innerHTML = ""; return; }
  const { data, error } = await sb.from("person_media")
    .select("*").eq("person_id", personId).order("created_at", { ascending: false });
  if (error) { grid.innerHTML = `<p class="obj-empty">Erreur : ${esc(error.message)}</p>`; return; }
  if (!data.length) { grid.innerHTML = `<p class="obj-empty">Aucune photo ni vidéo.</p>`; return; }
  grid.innerHTML = data.map((m) => {
    const media = m.kind === "video"
      ? `<video src="${esc(m.url)}" controls preload="metadata"></video>`
      : `<img src="${esc(m.url)}" alt="" />`;
    const badge = m.is_profile ? `<span class="media-badge">Profil</span>` : "";
    return `<div class="media-card" data-mid="${m.id}">
      <div class="media-thumb">${media}${badge}</div>
      <textarea class="media-comment" rows="2" placeholder="Commentaire…">${esc(m.comment || "")}</textarea>
      <button type="button" class="media-del" data-url="${esc(m.storage_path || "")}">Supprimer</button>
    </div>`;
  }).join("");
  grid.querySelectorAll(".media-comment").forEach((t) =>
    t.addEventListener("blur", () => saveMediaComment(t.closest(".media-card").dataset.mid, t.value)));
  grid.querySelectorAll(".media-del").forEach((b) =>
    b.addEventListener("click", () => deleteMedia(b.closest(".media-card").dataset.mid, b.dataset.url)));
}
async function uploadMedia(fileInput) {
  const id = $("p-id").value;
  if (!id || !fileInput.files || !fileInput.files[0]) return;
  const f = fileInput.files[0];
  const kind = f.type.startsWith("video") ? "video" : "image";
  $("media-status").textContent = "Envoi…";
  const path = `people/${id}/media/${Date.now()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
  const up = await sb.storage.from("gz-photos").upload(path, f, { upsert: true, contentType: f.type });
  if (up.error) { $("media-status").textContent = "Erreur : " + up.error.message; return; }
  const url = sb.storage.from("gz-photos").getPublicUrl(path).data.publicUrl;
  const { error } = await sb.from("person_media").insert({ person_id: id, url, storage_path: path, kind, created_by: meId });
  fileInput.value = "";
  $("media-status").textContent = error ? "Erreur : " + error.message : "";
  loadMedia(id);
}
async function saveMediaComment(mid, comment) {
  const { error } = await sb.from("person_media").update({ comment: comment.trim() || null }).eq("id", mid);
  if (error) { $("media-status").textContent = "Commentaire : " + error.message; return; }
  $("media-status").textContent = "✓ Commentaire enregistré";
  setTimeout(() => { if ($("media-status").textContent.startsWith("✓")) $("media-status").textContent = ""; }, 1500);
}
async function deleteMedia(mid, storagePath) {
  if (!confirm("Supprimer ce média ?")) return;
  if (storagePath) await sb.storage.from("gz-photos").remove([storagePath]);
  const { error } = await sb.from("person_media").delete().eq("id", mid);
  if (error) { $("media-status").textContent = "Suppression : " + error.message; return; }
  loadMedia($("p-id").value);
}

// ---- Cours suivis (présences) d'une personne ----
async function loadCourses(personId, showByRole) {
  const box = $("cours-content");
  const { data, error } = await sb.from("attendance")
    .select("status,courses(course_date,start_time,end_time,title,course_type_id,course_types(name,color))")
    .eq("person_id", personId).eq("is_coach", false);
  const rows = error ? [] : (data || []).filter((a) => a.courses);
  showPersonTab("cours", showByRole || rows.length > 0);
  if (error) { box.innerHTML = `<p class="obj-empty">Erreur : ${esc(error.message)}</p>`; return; }
  if (!rows.length) { box.innerHTML = `<p class="obj-empty">Aucun cours suivi.</p>`; return; }
  // Regroupe par type de cours
  const groups = {};
  for (const a of rows) {
    const c = a.courses;
    const tid = c.course_type_id || "?";
    const g = (groups[tid] = groups[tid] || { name: c.course_types?.name || "Cours", color: c.course_types?.color || "#3563E9", items: [] });
    g.items.push({ date: c.course_date, start: c.start_time, end: c.end_time, title: c.title, status: a.status });
  }
  const stLabel = { present: "Présent", late: "En retard", absent: "Absent" };
  const stClass = { present: "att-present", late: "att-late", absent: "att-absent" };
  box.innerHTML = Object.values(groups).map((g) => {
    g.items.sort((x, y) => (y.date || "").localeCompare(x.date || "") || (y.start || "").localeCompare(x.start || ""));
    const tot = g.items.length;
    const pres = g.items.filter((i) => i.status === "present").length;
    const late = g.items.filter((i) => i.status === "late").length;
    const abs = g.items.filter((i) => i.status === "absent").length;
    const pct = tot ? Math.round((pres / tot) * 100) : 0;
    const list = g.items.map((i) => {
      const d = i.date ? frDate(i.date) : "—";
      const h = `${(i.start || "").slice(0, 5)}–${(i.end || "").slice(0, 5)}`;
      return `<div class="att-row"><span class="att-d">${d}</span><span class="att-h">${h}</span>
        <span class="att-badge ${stClass[i.status] || ""}">${stLabel[i.status] || i.status}</span></div>`;
    }).join("");
    return `<div class="cours-group">
      <div class="cours-group-h">
        <span class="cours-dot" style="background:${esc(g.color)}"></span>
        <b>${esc(g.name)}</b>
        <span class="cours-pct">${pct}% présent</span>
        <span class="cours-brk">${pres} présent · ${late} retard · ${abs} absent · ${tot} cours</span>
      </div>
      <div class="att-list">${list}</div>
    </div>`;
  }).join("");
}

// ---- Réservations d'une personne ----
function seasonOf(d) {
  const dt = new Date(d), m = dt.getMonth() + 1, day = dt.getDate();
  const ete = (m > 4 && m < 10) || (m === 4 && day >= 15) || (m === 10 && day < 15);
  return ete ? "ete" : "hiver";
}
async function loadReservations(personId, showByRole) {
  const list = $("resa-list"), stats = $("resa-stats");
  // booked_by = la personne concernée ; partner_person_id = quand elle est l'invitée/partenaire
  const { data, error } = await sb.from("court_bookings")
    .select("booking_date,start_time,end_time,price_chf,kind,title,partner_person_id,booked_by,courts(name)")
    .or(`booked_by.eq.${personId},partner_person_id.eq.${personId}`)
    .order("booking_date", { ascending: false }).order("start_time", { ascending: false });
  const rows = error ? [] : (data || []);
  showPersonTab("resa", showByRole || rows.length > 0);
  if (error) { stats.innerHTML = ""; list.innerHTML = `<p class="obj-empty">Erreur : ${esc(error.message)}</p>`; return; }
  if (!rows.length) { stats.innerHTML = ""; list.innerHTML = `<p class="obj-empty">Aucune réservation.</p>`; return; }
  // Stats par année + saison
  const agg = {};
  for (const b of rows) {
    const y = (b.booking_date || "").slice(0, 4);
    const s = seasonOf(b.booking_date);
    const key = `${y}|${s}`;
    (agg[key] = agg[key] || { count: 0, sum: 0 });
    agg[key].count++; agg[key].sum += Number(b.price_chf || 0);
  }
  const keys = Object.keys(agg).sort().reverse();
  stats.innerHTML = keys.map((k) => {
    const [y, s] = k.split("|");
    const a = agg[k];
    const lbl = s === "ete" ? "Été" : "Hiver";
    return `<div class="resa-stat"><div class="resa-stat-h">${y} · ${lbl}</div>
      <div class="resa-stat-n">${a.count} résa${a.count > 1 ? "s" : ""}</div>
      <div class="resa-stat-s">${a.sum.toFixed(2)} CHF</div></div>`;
  }).join("");
  list.innerHTML = rows.map((b) => {
    const d = b.booking_date ? frDate(b.booking_date) : "—";
    const h = `${(b.start_time || "").slice(0, 5)}–${(b.end_time || "").slice(0, 5)}`;
    const court = b.courts?.name || "Court";
    const price = b.price_chf != null ? `${Number(b.price_chf).toFixed(2)} CHF` : "—";
    return `<div class="resa-row"><span class="resa-d">${d}</span><span class="resa-h">${h}</span>
      <span class="resa-c">${esc(court)}</span><span class="resa-p">${price}</span></div>`;
  }).join("");
}

// ---- Objectifs ----
async function loadObjectives(personId) {
  const list = $("obj-list");
  const hasP = !!personId;
  $("obj-body").disabled = !hasP;
  $("obj-add-btn").disabled = !hasP;
  $("obj-need-save").hidden = hasP;
  if (!hasP) { list.innerHTML = ""; return; }
  const { data, error } = await sb.from("person_objectives")
    .select("*").eq("person_id", personId).order("created_at", { ascending: false });
  if (error) { list.innerHTML = `<p class="obj-empty">Erreur : ${esc(error.message)}</p>`; return; }
  if (!data.length) { list.innerHTML = `<p class="obj-empty">Aucun objectif pour le moment.</p>`; return; }
  list.innerHTML = data.map((o) => {
    const mine = o.created_by === meId;
    const dt = frDateTime(o.created_at);
    const edited = o.updated_at && o.updated_at !== o.created_at ? ' <span class="muted">(modifié)</span>' : "";
    return `<div class="obj-item" data-oid="${o.id}">
      <div class="obj-meta"><b>${esc(o.author_name || "—")}</b><span>${dt}${edited}</span></div>
      <div class="obj-body">${esc(o.body)}</div>
      ${mine ? `<div class="obj-acts"><button type="button" class="edit">Modifier</button><button type="button" class="del">Supprimer</button></div>` : ""}
    </div>`;
  }).join("");
  list.querySelectorAll(".obj-item .edit").forEach((b) =>
    b.addEventListener("click", () => editObjective(b.closest(".obj-item").dataset.oid)));
  list.querySelectorAll(".obj-item .del").forEach((b) =>
    b.addEventListener("click", () => deleteObjective(b.closest(".obj-item").dataset.oid)));
}
async function addObjective() {
  const id = $("p-id").value;
  const body = $("obj-body").value.trim();
  if (!id || !body) return;
  const { error } = await sb.from("person_objectives").insert({
    person_id: id, body, author_name: meName, created_by: meId,
  });
  if (error) { alert("Objectif : " + error.message); return; }
  $("obj-body").value = "";
  loadObjectives(id);
}
async function editObjective(oid) {
  const el = document.querySelector(`.obj-item[data-oid="${oid}"] .obj-body`);
  const current = el ? el.textContent : "";
  const next = prompt("Modifier l'objectif :", current);
  if (next === null) return;
  const body = next.trim();
  if (!body) return;
  const { error } = await sb.from("person_objectives")
    .update({ body, updated_at: new Date().toISOString() }).eq("id", oid);
  if (error) { alert("Objectif : " + error.message); return; }
  loadObjectives($("p-id").value);
}
async function deleteObjective(oid) {
  if (!confirm("Supprimer cet objectif ?")) return;
  const { error } = await sb.from("person_objectives").delete().eq("id", oid);
  if (error) { alert("Objectif : " + error.message); return; }
  loadObjectives($("p-id").value);
}

// ---- Saisons (rôles saisonniers = source de vérité, rattachés à une saison) ----
function seasonOpt(s, curId) {
  return `<option value="${s.id}"${s.id === curId ? " selected" : ""}>${esc(s.label)}${s.id === curId ? " (en cours)" : ""}</option>`;
}
async function loadPersonSeasons(personId) {
  const curCot = currentSeason("cotisation"), curJun = currentSeason("juniors");
  const cotS = seasonsOf("cotisation"), junS = seasonsOf("juniors");
  $("ss-cot-season").innerHTML = cotS.length ? cotS.map((s) => seasonOpt(s, curCot?.id)).join("") : '<option value="">— aucune saison —</option>';
  $("ss-jun-season").innerHTML = junS.length ? junS.map((s) => seasonOpt(s, curJun?.id)).join("") : '<option value="">— aucune saison —</option>';
  $("ss-jun-role").innerHTML = SEASONAL_JUNIORS.map((r) => `<option value="${r}">${esc(roleLabel(r))}</option>`).join("");
  const enable = !!personId;
  ["ss-cot-add", "ss-jun-add", "ss-cot-season", "ss-jun-season", "ss-jun-role"].forEach((id) => { $(id).disabled = !enable; });
  if (!enable) { $("ss-cot-list").innerHTML = '<p class="muted" style="font-size:.85rem">Enregistrez d\'abord la personne.</p>'; $("ss-jun-list").innerHTML = ""; return; }

  const { data } = await sb.from("role_periods").select("*, seasons(id,kind,label,start_date)").eq("person_id", personId);
  const rows = (data || []).filter((r) => r.seasons);
  const intentSel = (r) => `<select class="ss-intent" data-id="${r.id}">
    <option value="">Intention suivante…</option>
    ${INTENTS.map(([v, l]) => `<option value="${v}"${r.next_intent === v ? " selected" : ""}>${l}</option>`).join("")}</select>`;

  const cots = rows.filter((r) => r.seasons.kind === "cotisation").sort((a, b) => b.seasons.start_date.localeCompare(a.seasons.start_date));
  $("ss-cot-list").innerHTML = cots.length ? cots.map((r) => `
    <div class="ss-row${r.season_id === curCot?.id ? " ss-cur" : ""}">
      <span class="ss-season">${esc(r.seasons.label)}</span>
      <label class="ss-paid"><input type="checkbox" class="ss-paid-chk" data-id="${r.id}" ${r.paid ? "checked" : ""}/> Payé</label>
      <span class="ss-status">${r.paid ? '<span class="ss-tag ss-ok">Membre</span>' : '<span class="ss-tag ss-warn">Non payé</span>'}</span>
      ${intentSel(r)}
      <button type="button" class="fam-del ss-del" data-id="${r.id}">✕</button>
    </div>`).join("") : '<p class="muted" style="font-size:.85rem">Aucune cotisation enregistrée.</p>';

  const juns = rows.filter((r) => r.seasons.kind === "juniors").sort((a, b) => b.seasons.start_date.localeCompare(a.seasons.start_date) || a.role.localeCompare(b.role));
  $("ss-jun-list").innerHTML = juns.length ? juns.map((r) => `
    <div class="ss-row${r.season_id === curJun?.id ? " ss-cur" : ""}">
      <span class="ss-season">${esc(r.seasons.label)}</span>
      <span class="ss-status"><span class="ss-tag ss-role">${esc(roleLabel(r.role))}</span></span>
      ${intentSel(r)}
      <button type="button" class="fam-del ss-del" data-id="${r.id}">✕</button>
    </div>`).join("") : '<p class="muted" style="font-size:.85rem">Aucune filière enregistrée.</p>';

  $("ptab-seasons").querySelectorAll(".ss-del").forEach((b) => b.addEventListener("click", () => deleteSeasonPeriod(b.dataset.id)));
  $("ptab-seasons").querySelectorAll(".ss-paid-chk").forEach((c) => c.addEventListener("change", () => updateSeasonPeriod(c.dataset.id, { paid: c.checked })));
  $("ptab-seasons").querySelectorAll(".ss-intent").forEach((s) => s.addEventListener("change", () => updateSeasonPeriod(s.dataset.id, { next_intent: s.value || null })));
}
async function addSeasonRole(kind, role) {
  const pid = $("p-id").value;
  const seasonId = $(kind === "cotisation" ? "ss-cot-season" : "ss-jun-season").value;
  if (!pid || !role) return;
  if (!seasonId) { alert("Crée d'abord une saison dans Réglages › Saisons."); return; }
  const { error } = await sb.from("role_periods").insert({ person_id: pid, season_id: seasonId, role, created_by: meId });
  if (error) { alert(error.code === "23505" ? "Déjà enregistré pour cette saison." : error.message); return; }
  loadPersonSeasons(pid);
  loadPeople();
}
async function updateSeasonPeriod(id, patch) {
  const { error } = await sb.from("role_periods").update(patch).eq("id", id);
  if (error) { alert(error.message); return; }
  loadPersonSeasons($("p-id").value);
  if ("paid" in patch) loadPeople();
}
async function deleteSeasonPeriod(id) {
  if (!confirm("Retirer cette saison ?")) return;
  const { error } = await sb.from("role_periods").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  loadPersonSeasons($("p-id").value);
  loadPeople();
}

let personPhotoUrl = null;
let personRolesSel = new Set();
function renderPersonPhoto() {
  const box = $("p-photo-preview");
  box.innerHTML = personPhotoUrl ? `<img src="${personPhotoUrl}" alt="" />` : "";
  box.classList.toggle("empty", !personPhotoUrl);
}
function renderPersonRoles(roles) {
  personRolesSel = new Set(roles);
  $("p-roles").innerHTML = PERSON_ROLES.map(([v, l]) =>
    `<button type="button" class="chip${personRolesSel.has(v) ? " sel" : ""}" data-role="${v}">${esc(l)}</button>`).join("");
  $("p-roles").querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
    const r = b.dataset.role;
    personRolesSel.has(r) ? personRolesSel.delete(r) : personRolesSel.add(r);
    b.classList.toggle("sel");
  }));
}
async function uploadPersonPhoto(file) {
  if (!file.files || !file.files[0]) return;
  const f = file.files[0];
  const path = `people/${$("p-id").value || "new"}-${Date.now()}`;
  const { error } = await sb.storage.from("gz-photos").upload(path, f, { upsert: true, contentType: f.type });
  if (error) { alert("Photo : " + error.message); return; }
  personPhotoUrl = sb.storage.from("gz-photos").getPublicUrl(path).data.publicUrl;
  renderPersonPhoto();
  // La photo de profil s'ajoute aussi dans l'onglet Photos / vidéos (commentaire éditable)
  const id = $("p-id").value;
  if (id) {
    await sb.from("person_media").insert({
      person_id: id, url: personPhotoUrl, storage_path: path, kind: "image",
      is_profile: true, comment: "Photo de profil", created_by: meId,
    });
    loadMedia(id);
  }
}

async function loadCredit(personId) {
  $("cr-amount").value = ""; $("cr-reason").value = "";
  const [{ data: bal }, { data: led }] = await Promise.all([
    sb.rpc("wallet_balance", { p_person: personId }),
    sb.from("wallet_ledger").select("amount,reason,created_at").eq("person_id", personId).order("created_at", { ascending: false }).limit(12),
  ]);
  $("cr-balance").textContent = `${Number(bal ?? 0)} CHF`;
  const rows = led || [];
  $("cr-ledger").innerHTML = rows.length ? rows.map((r) =>
    `<div class="cr-row"><span>${frDate(r.created_at)} · ${esc(r.reason || "")}</span>
      <b style="color:${r.amount >= 0 ? "#0b6b3a" : "#b3261e"}">${r.amount >= 0 ? "+" : ""}${r.amount}</b></div>`).join("")
    : '<p class="muted" style="font-size:.85rem;margin:6px 0 0">Aucun mouvement.</p>';
}

async function rechargeCredit() {
  const id = $("p-id").value; if (!id) return;
  const amount = Number($("cr-amount").value);
  if (!amount || amount <= 0) { alert("Montant invalide."); return; }
  const { error } = await sb.from("wallet_ledger").insert({
    person_id: id, amount, reason: $("cr-reason").value.trim() || "Recharge", created_by: meId,
  });
  if (error) { alert("Recharge impossible : " + error.message); return; }
  loadCredit(id);
}

function populateFamPersons(selfId) {
  $("fam-person").innerHTML = '<option value="">— Choisir une personne —</option>' +
    people.filter((x) => x.id !== selfId).map((x) =>
      `<option value="${x.id}">${esc(x.last_name)} ${esc(x.first_name)}</option>`).join("");
}

async function loadFamily(id) {
  const { data } = await sb.from("guardianships").select("*").or(`guardian_id.eq.${id},child_id.eq.${id}`);
  const nameOf = (pid) => { const p = people.find((x) => x.id === pid); return p ? `${p.last_name} ${p.first_name}` : "—"; };
  const rows = data || [];
  $("family-list").innerHTML = rows.length ? rows.map((g) => {
    const isParent = g.guardian_id === id;
    const other = isParent ? g.child_id : g.guardian_id;
    const label = g.relation === "sibling"
      ? `Frère / sœur : ${nameOf(other)}`
      : (isParent ? `Enfant : ${nameOf(other)}` : `Parent/tuteur : ${nameOf(other)}`);
    return `<div class="fam-item"><span>${label}</span><button type="button" class="fam-del" data-g="${g.guardian_id}" data-c="${g.child_id}">✕</button></div>`;
  }).join("") : '<p class="muted" style="font-size:.85rem;margin:0">Aucun lien.</p>';
  $("family-list").querySelectorAll(".fam-del").forEach((b) =>
    b.addEventListener("click", () => removeFamily(b.dataset.g, b.dataset.c, id)));
}

async function addFamily() {
  const id = $("p-id").value;
  if (!id) { alert("Enregistrez d'abord la fiche."); return; }
  const other = $("fam-person").value;
  if (!other) return;
  const dir = $("fam-dir").value;
  let row;
  if (dir === "sibling") {
    // Lien non orienté : on ordonne les ids pour éviter les doublons A-B / B-A
    const [a, b] = [id, other].sort();
    row = { guardian_id: a, child_id: b, relation: "sibling" };
  } else if (dir === "child") {
    row = { guardian_id: id, child_id: other, relation: "parent" };
  } else {
    row = { guardian_id: other, child_id: id, relation: "parent" };
  }
  const { error } = await sb.from("guardianships").insert(row);
  if (error) { alert("Lien impossible : " + (error.code === "23505" ? "ce lien existe déjà." : error.message)); return; }
  $("fam-person").value = "";
  loadFamily(id);
}

async function removeFamily(g, c, id) {
  await sb.from("guardianships").delete().eq("guardian_id", g).eq("child_id", c);
  loadFamily(id);
}

// ===================================================================
//  Cours
// ===================================================================
let courseTypes = [];
let isHeadUser = false, isAdminUser = false;
const QH = (() => { const a = []; for (let h = 7; h <= 22; h++) for (const m of [0, 15, 30, 45]) { if (h === 22 && m > 0) break; a.push(pad2(h) + ":" + pad2(m)); } return a; })();

function initCours(roles) {
  isHeadUser = roles.some((r) => ["superadmin", "admin", "head_coach"].includes(r));
  isAdminUser = roles.some((r) => ["superadmin", "admin"].includes(r));
  $("ct-card").querySelector(".ct-add").classList.toggle("hidden", !isAdminUser);
  $("cs-new").classList.toggle("hidden", !isHeadUser);
  $("cs-copy").classList.toggle("hidden", !isHeadUser);

  $("c-start").innerHTML = QH.map((t) => `<option value="${t}">${t}</option>`).join("");
  $("c-end").innerHTML = QH.map((t) => `<option value="${t}">${t}</option>`).join("");

  document.querySelectorAll("#view-cours .cours-subtab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#view-cours .cours-subtab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("#view-cours .cours-sub").forEach((s) => s.classList.toggle("hidden", s.id !== "cours-sub-" + b.dataset.sub));
    }));
  $("ct-add-btn").addEventListener("click", addType);
  $("cs-date").value = isoA(new Date());
  $("cs-date").addEventListener("change", loadCoursesDay);
  $("cs-prev").addEventListener("click", () => shiftCs(-1));
  $("cs-next").addEventListener("click", () => shiftCs(1));
  $("cs-new").addEventListener("click", () => openCourse(null));
  $("cs-copy").addEventListener("click", copyWeek);
  $("cw-close").addEventListener("click", () => $("copyweek-modal").classList.add("hidden"));
  $("copyweek-modal").addEventListener("click", (e) => { if (e.target === $("copyweek-modal")) $("copyweek-modal").classList.add("hidden"); });
  $("cw-go").addEventListener("click", cwGo);
  $("cw-date").addEventListener("change", () => { if (cwToCreate) { cwToCreate = null; $("cw-summary").hidden = true; $("cw-go").disabled = false; $("cw-go").textContent = "Vérifier"; } });
  $("course-close").addEventListener("click", () => $("course-modal").classList.add("hidden"));
  $("course-modal").addEventListener("click", (e) => { if (e.target === $("course-modal")) $("course-modal").classList.add("hidden"); });
  $("course-form").addEventListener("submit", saveCourse);
  $("c-del").addEventListener("click", deleteCourse);
  $("c-children").addEventListener("click", updateCount);
  $("att-close").addEventListener("click", () => $("att-modal").classList.add("hidden"));
  $("att-modal").addEventListener("click", (e) => { if (e.target === $("att-modal")) $("att-modal").classList.add("hidden"); });

  loadTypes();
  loadCoursesDay();
}

async function loadTypes() {
  const { data } = await sb.from("course_types").select("*").order("name");
  courseTypes = data || [];
  $("ct-list").innerHTML = courseTypes.length ? courseTypes.map((t) =>
    `<div class="ct-item"><span class="ct-dot" style="background:${t.color}"></span>
      <b>${esc(t.name)}</b>
      ${isAdminUser ? `<button type="button" class="fam-del" data-id="${t.id}">✕</button>` : ""}</div>`).join("")
    : '<p class="muted" style="font-size:.85rem">Aucun type de cours.</p>';
  $("ct-list").querySelectorAll(".fam-del").forEach((b) => b.addEventListener("click", () => deleteType(b.dataset.id)));
  $("c-type").innerHTML = '<option value="">— Type —</option>' +
    courseTypes.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
}

async function addType() {
  const name = $("ct-name").value.trim();
  if (!name) return;
  const { error } = await sb.from("course_types").insert({ name, color: $("ct-color").value });
  if (error) { alert("Impossible : " + (error.code === "23505" ? "ce type existe déjà." : error.message)); return; }
  $("ct-name").value = "";
  loadTypes();
}
async function deleteType(id) {
  if (!confirm("Supprimer ce type de cours ?")) return;
  const { error } = await sb.from("course_types").delete().eq("id", id);
  if (error) { alert("Impossible (type utilisé par un cours ?) : " + error.message); return; }
  loadTypes();
}

function shiftCs(delta) {
  const d = new Date($("cs-date").value + "T00:00:00");
  d.setDate(d.getDate() + delta);
  $("cs-date").value = isoA(d);
  loadCoursesDay();
}

const personName = (pid) => { const p = people.find((x) => x.id === pid); return p ? `${p.last_name} ${p.first_name}` : "—"; };

// Peut-on marquer cette pastille ? (miroir de la RPC mark_attendance)
function canMarkBox(course, coachIds, pid, isCoach) {
  if (isHeadUser) return true;                     // head/admin/superadmin : tout, tout le temps
  if (!myPersonId || !coachIds.includes(myPersonId)) return false; // doit être coach du cours
  if (isCoach) return pid === myPersonId;          // un coach ne valide que sa propre présence
  const start = new Date(`${course.course_date}T${course.start_time}`);
  return Date.now() <= start.getTime() + 10 * 60000; // enfant : jusqu'à 10 min après le début
}

function attChip(course, coachIds, pid, isCoach, status) {
  const can = canMarkBox(course, coachIds, pid, isCoach);
  const cls = status === "present" ? "st-present" : status === "late" ? "st-late"
    : status === "absent" ? "st-absent" : (can ? "st-none" : "st-locked");
  return `<button type="button" class="att-chip ${cls}" data-course="${course.id}" data-person="${pid}"
    data-coach="${isCoach ? 1 : 0}" data-status="${status || ""}" data-can="${can ? 1 : 0}"
    title="${esc(personName(pid))}">${esc(personName(pid))}</button>`;
}

// Une colonne (Coachs ou Élèves) de pastilles de présence. statusFn(pid) → statut.
function attCol(course, coachIds, list, isCoach, title, statusFn) {
  return `<div class="cs-att-col"><div class="cs-att-h">${title}</div>
    <div class="cs-att-items">${list.length
      ? list.map((pid) => attChip(course, coachIds, pid, isCoach, statusFn(pid))).join("")
      : '<span class="muted" style="font-size:.8rem">—</span>'}</div></div>`;
}

async function loadCoursesDay() {
  const date = $("cs-date").value;
  const { data: courses } = await sb.from("courses").select("*").eq("course_date", date).order("start_time");
  const ids = (courses || []).map((c) => c.id);
  let books = [], coaches = [], parts = [], att = [];
  if (ids.length) {
    [books, coaches, parts, att] = await Promise.all([
      sb.from("court_bookings").select("court_id,course_id").in("course_id", ids).then((r) => r.data || []),
      sb.from("course_coaches").select("course_id,coach_person_id").in("course_id", ids).then((r) => r.data || []),
      sb.from("course_participants").select("course_id,child_person_id").in("course_id", ids).then((r) => r.data || []),
      sb.from("attendance").select("course_id,person_id,status").in("course_id", ids).then((r) => r.data || []),
    ]);
  }
  const courtName = (id) => (resaCourtsAll.find((c) => c.id === id)?.name || "?").replace("Court ", "C");
  const attOf = (cid, pid) => att.find((a) => a.course_id === cid && a.person_id === pid)?.status || "";
  const col = (course, coachIds, list, isCoach, title) => attCol(course, coachIds, list, isCoach, title, (pid) => attOf(course.id, pid));

  $("cs-list").innerHTML = (courses || []).length ? (courses || []).map((c) => {
    const cts = books.filter((b) => b.course_id === c.id).map((b) => courtName(b.court_id)).join(", ");
    const coachIds = coaches.filter((x) => x.course_id === c.id).map((x) => x.coach_person_id);
    const childIds = parts.filter((x) => x.course_id === c.id).map((x) => x.child_person_id);
    const type = courseTypes.find((t) => t.id === c.course_type_id);
    const needMore = Math.max(coachIds.length, childIds.length) > 4;
    return `<div class="cs-card" data-id="${c.id}" style="border-left-color:${c.color || (type?.color) || "#0b6b3a"}">
      <div class="cs-card-top">
        <div class="cs-time">${c.start_time.slice(0, 5)}–${c.end_time.slice(0, 5)}</div>
        <div class="cs-main"><b>${esc(c.title || type?.name || "Cours")}</b>
          <span class="muted">${type ? esc(type.name) + " · " : ""}Courts ${cts || "—"}</span></div>
        ${needMore ? '<button type="button" class="cs-more">Plus</button>' : ""}
      </div>
      <div class="cs-att">${col(c, coachIds, coachIds, true, "Coachs")}${col(c, coachIds, childIds, false, "Élèves")}</div>
    </div>`;
  }).join("") : '<p class="muted">Aucun cours ce jour.</p>';

  const L = $("cs-list");
  L.querySelectorAll(".att-chip").forEach((ch) => ch.addEventListener("click", (e) => { e.stopPropagation(); cycleAtt(ch); }));
  L.querySelectorAll(".cs-more").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation();
    const card = b.closest(".cs-card");
    b.textContent = card.classList.toggle("expanded") ? "Réduire" : "Plus";
  }));
  if (isHeadUser) L.querySelectorAll(".cs-card").forEach((el) =>
    el.addEventListener("click", (e) => { if (e.target.closest(".att-chip,.cs-more")) return; editCourse(el.dataset.id); }));
}

// Clic sur une pastille : blanc → vert → rouge → orange → blanc
async function cycleAtt(chip) {
  if (chip.dataset.can !== "1") return; // verrouillé
  const course = chip.dataset.course, pid = chip.dataset.person, isCoach = chip.dataset.coach === "1";
  const cur = chip.dataset.status || "";
  const next = cur === "" ? "present" : cur === "present" ? "absent" : cur === "absent" ? "late" : null;
  chip.disabled = true;
  const { error } = next === null
    ? await sb.rpc("clear_attendance", { p_course: course, p_person: pid, p_is_coach: isCoach })
    : await sb.rpc("mark_attendance", { p_course: course, p_person: pid, p_status: next, p_is_coach: isCoach });
  chip.disabled = false;
  if (error) { alert(error.message); return; }
  chip.dataset.status = next || "";
  chip.classList.remove("st-present", "st-late", "st-absent", "st-none", "st-locked");
  chip.classList.add(next === "present" ? "st-present" : next === "late" ? "st-late" : next === "absent" ? "st-absent" : "st-none");
}

// ---- Présences ----
let attCourse = null;
const ATT_STATUS = [["present", "Présent"], ["absent", "Absent"], ["late", "En retard"]];

async function openAttendance(courseId) {
  const course = (await sb.from("courses").select("*").eq("id", courseId).single()).data;
  attCourse = course;
  const [parts, coaches, att] = await Promise.all([
    sb.from("course_participants").select("child_person_id").eq("course_id", courseId).then((r) => (r.data || []).map((x) => x.child_person_id)),
    sb.from("course_coaches").select("coach_person_id").eq("course_id", courseId).then((r) => (r.data || []).map((x) => x.coach_person_id)),
    sb.from("attendance").select("*").eq("course_id", courseId).then((r) => r.data || []),
  ]);
  const statusOf = (pid) => att.find((a) => a.person_id === pid)?.status || null;
  const nameOf = (pid) => { const p = people.find((x) => x.id === pid); return p ? `${p.last_name} ${p.first_name}` : "—"; };

  $("att-title").textContent = `Présences — ${course.title || "cours"} (${course.start_time.slice(0, 5)})`;
  const openAt = new Date(`${course.course_date}T${course.start_time}`); openAt.setMinutes(openAt.getMinutes() - 5);
  const early = new Date() < openAt;
  $("att-note").textContent = early
    ? `Le pointage des enfants ouvre à ${pad2(openAt.getHours())}:${pad2(openAt.getMinutes())} (5 min avant). Head coach/admin : à tout moment.`
    : "Cliquez pour marquer présent / absent / en retard.";

  $("att-children").innerHTML = parts.length ? parts.map((pid) => attRow(pid, nameOf(pid), statusOf(pid), false)).join("") : '<p class="muted" style="font-size:.85rem">Aucun enfant.</p>';
  $("att-coaches").innerHTML = coaches.length ? coaches.map((pid) => attRow(pid, nameOf(pid), statusOf(pid), true)).join("") : '<p class="muted" style="font-size:.85rem">Aucun coach.</p>';
  $("att-modal").querySelectorAll(".att-set").forEach((b) =>
    b.addEventListener("click", () => markAtt(b.dataset.person, b.dataset.status, b.dataset.coach === "1")));
  $("att-modal").classList.remove("hidden");
}

function attRow(pid, name, status, isCoach) {
  const btns = ATT_STATUS.map(([s, l]) =>
    `<button type="button" class="att-set st-${s} ${status === s ? "on" : ""}" data-person="${pid}" data-status="${s}" data-coach="${isCoach ? 1 : 0}">${l}</button>`).join("");
  return `<div class="att-row"><span class="att-name">${esc(name)}</span><div class="att-btns">${btns}</div></div>`;
}

async function markAtt(personId, status, isCoach) {
  const { error } = await sb.rpc("mark_attendance", {
    p_course: attCourse.id, p_person: personId, p_status: status, p_is_coach: isCoach,
  });
  if (error) { alert(error.message); return; }
  openAttendance(attCourse.id); // refresh
}

// ===================================================================
//  GameZone — saisons + catégories de tarifs (Phase 1)
// ===================================================================
let gzRoles = [], gzPersonId = null, gzIsOfficial = false;

async function initGameZone(roles) {
  gzRoles = roles || [];
  gzIsOfficial = gzRoles.some((r) => ["superadmin", "admin", "organisateur"].includes(r));
  const { data: prof } = await sb.from("profiles").select("person_id").eq("user_id", meId).maybeSingle();
  gzPersonId = prof?.person_id || null;
  if (!gzIsOfficial) {
    document.querySelector('#view-gamezone .subtab[data-sub="reglages"]')?.classList.add("hidden");
    document.querySelector('#view-gamezone .subtab[data-sub="participants"]')?.classList.add("hidden");
    document.querySelector('#view-gamezone .subtab[data-sub="financier"]')?.classList.add("hidden");
    document.querySelector('#view-gamezone .subtab[data-sub="communication"]')?.classList.add("hidden");
    document.querySelector('#view-gamezone .subtab[data-sub="sondages"]')?.classList.add("hidden");
    document.querySelector('#view-gamezone .subtab[data-sub="site"]')?.classList.add("hidden");
    $("gz-bm-card")?.classList.add("hidden");
    $("gz-official-box")?.classList.add("hidden");
  }
  $("gz-fin-season").addEventListener("change", renderFinance);
  $("gz-part-search").addEventListener("input", renderParts);
  document.querySelectorAll('#gz-sub-participants th[data-sort]').forEach((th) =>
    th.addEventListener("click", () => { gzPartSort = th.dataset.sort; renderParts(); }));
  $("gz-season-new").addEventListener("click", createSeason);
  $("gz-cat-new").addEventListener("click", createCat);
  $("gz-survey-new").addEventListener("click", () => createSurvey("gamezone"));
  document.querySelectorAll("#view-gamezone .subtab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#view-gamezone .subtab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("#view-gamezone .gz-sub").forEach((s) => s.classList.toggle("hidden", s.id !== "gz-sub-" + b.dataset.sub));
      if (b.dataset.sub === "participants") loadParticipantsTab();
      if (b.dataset.sub === "financier") loadFinanceTab();
      if (b.dataset.sub === "communication") loadMailTab();
      if (b.dataset.sub === "sondages") loadSurveyTab("gamezone");
      if (b.dataset.sub === "site") loadSiteTab();
    }));
  $("gz-detail-back").addEventListener("click", closeDetail);
  $("gz-resp-add").addEventListener("click", addResponsable);
  $("gz-mov-add").addEventListener("click", addMovement);
  $("gz-mgr-cat").addEventListener("change", async () => {
    await sb.from("gz_tournaments").update({ price_category_id: $("gz-mgr-cat").value || null }).eq("id", mgrTid);
    renderMgr();
  });
  $("gz-mgr-gz").addEventListener("change", async () => {
    mgrIsGz = $("gz-mgr-gz").checked;
    await sb.from("gz_tournaments").update({ is_gamezone: mgrIsGz }).eq("id", mgrTid);
    renderMgr();
  });
  $("gz-pay-add").addEventListener("click", addPayment);
  $("gz-sal-add").addEventListener("click", addSalary);
  $("gz-caisse-start").addEventListener("change", saveCaisse);
  $("gz-caisse-counted").addEventListener("change", saveCaisse);
  $("gz-close-tournament").addEventListener("click", closeTournament);
  loadSeasons();
  loadCats();
  loadTournaments();
  loadBookmarklet();
}

async function loadBookmarklet() {
  const { data } = await sb.from("gz_config").select("import_key").maybeSingle();
  if (!data) { $("gz-bm-note").textContent = "Clé d'import indisponible (droits admin requis)."; return; }
  let src;
  try { src = await (await fetch("bookmarklet.js")).text(); }
  catch (_e) { $("gz-bm-note").textContent = "Impossible de charger le bookmarklet."; return; }
  const code = src
    .replace("__KEY__", data.import_key)
    .replace("__RCV__", location.origin + "/gz-receiver.html");
  const a = document.createElement("a");
  a.href = "javascript:" + encodeURIComponent(code);
  a.textContent = "Importer GameZone";
  a.className = "btn-prod";
  a.style.textDecoration = "none";
  a.addEventListener("click", (e) => {
    e.preventDefault();
    alert("Ne cliquez pas ici : GLISSEZ ce bouton dans votre barre de favoris, puis utilisez-le une fois connecté sur la page Swiss Tennis.");
  });
  $("gz-bm-holder").innerHTML = "";
  $("gz-bm-holder").appendChild(a);
  $("gz-bm-note").textContent = "Astuce : glissez-le dans la barre de favoris (ou clic droit → Ajouter aux favoris).";
}

async function loadTournaments() {
  const [{ data: tournaments }, { data: cnts }, { data: seasons }] = await Promise.all([
    sb.from("gz_tournaments").select("*").order("tournament_date", { ascending: false, nullsFirst: false }),
    sb.from("gz_tournament_counts").select("tournament_id,inscrits,selectionnes"),
    sb.from("gz_seasons").select("id,name,start_date,end_date").order("start_date", { ascending: false }),
  ]);
  const counts = {};
  for (const c of cnts || []) counts[c.tournament_id] = { p: c.inscrits, s: c.selectionnes };
  let rows = tournaments || [];
  if (!gzIsOfficial) {
    const { data: mine } = await sb.from("gz_managers").select("tournament_id").eq("person_id", gzPersonId);
    const allowed = new Set((mine || []).map((m) => m.tournament_id));
    rows = rows.filter((t) => allowed.has(t.id) && t.status !== "Clôturé");
  }
  $("gz-tourn-count").textContent = rows.length ? `${rows.length} tournoi(s)` : "";
  const seasonName = {};
  for (const s of seasons || []) seasonName[s.id] = s.name;
  const seasonOfDate = (d) => {
    if (!d) return "none";
    const s = (seasons || []).find((x) => d >= x.start_date && d <= x.end_date);
    return s ? s.id : "none";
  };
  const groups = {};
  for (const t of rows) { const k = seasonOfDate(t.tournament_date); (groups[k] || (groups[k] = [])).push(t); }
  const order = (seasons || []).map((s) => s.id).concat("none");
  let html = "";
  for (const sid of order) {
    const g = groups[sid];
    if (!g || !g.length) continue;
    html += `<h3 class="gz-season-h">${sid === "none" ? "Hors saison" : esc(seasonName[sid] || "—")} <span class="muted" style="font-weight:400">(${g.length})</span></h3>`;
    html += `<div class="table-wrap" style="margin-bottom:16px"><table class="crm-table"><thead><tr><th>Tournoi</th><th>Date</th><th>Statut</th><th>Inscrits</th><th>Sélect.</th></tr></thead><tbody>`;
    let ti = 0, ts = 0;
    for (const t of g) {
      const c = counts[t.id] || { p: 0, s: 0 };
      ti += c.p; ts += c.s;
      const drawn = /peuvent être joués|visibles au public/i.test((t.status || "") + JSON.stringify(t.epreuves || ""));
      const badge = t.is_gamezone ? '<span class="gz-badge">GameZone</span>' : '<span class="gz-badge off">autre</span>';
      html += `<tr class="gz-trow" data-tid="${t.id}"><td>${badge} ${esc(t.name || "—")}</td><td>${t.tournament_date || "—"}</td><td>${esc(t.status || "—")}${drawn ? " ✓" : ""}</td><td>${c.p}</td><td>${c.s}</td></tr>`;
    }
    html += `<tr class="gz-total"><td colspan="3">Total — ${g.length} tournoi(s)</td><td>${ti}</td><td>${ts}</td></tr>`;
    html += "</tbody></table></div>";
  }
  $("gz-tournaments-groups").innerHTML = html || '<p class="muted">Aucun tournoi importé. Utilisez le bookmarklet ci-dessous.</p>';
  $("gz-tournaments-groups").querySelectorAll(".gz-trow").forEach((r) =>
    r.addEventListener("click", () => openTournamentMgr(r.dataset.tid)));
}

// ---- Gestion d'un tournoi (responsable) ----
let mgrTid = null, mgrCats = [], mgrPlayers = [], mgrIsGz = false;

async function openTournamentMgr(tid) {
  mgrTid = tid;
  const { data: t } = await sb.from("gz_tournaments").select("*").eq("id", tid).single();
  mgrIsGz = !!t.is_gamezone;
  mgrTournamentName = t.name || "Tournoi";
  $("gz-mgr-title").textContent = `Gérer — ${t.name || "tournoi"} (${t.tournament_date || ""})`;
  $("gz-mgr-gz").checked = mgrIsGz;
  const { data: cats } = await sb.from("gz_price_categories").select("*").order("created_at");
  mgrCats = cats || [];
  $("gz-mgr-cat").innerHTML = '<option value="">— catégorie de tarifs —</option>' +
    mgrCats.map((c) => `<option value="${c.id}" ${c.id === t.price_category_id ? "selected" : ""}>${esc(c.name)}</option>`).join("");
  const { data: entries } = await sb.from("gz_entries").select("participant_id").eq("tournament_id", tid).eq("confirmed", true);
  const ids = [...new Set((entries || []).map((e) => e.participant_id))];
  if (!ids.length) {
    $("gz-mgr-players").innerHTML = '<tr><td colspan="6" class="muted">Aucun joueur sélectionné (tirage pas encore fait ?).</td></tr>';
    $("gz-mgr-totals").innerHTML = "";
  } else {
    const { data: parts } = await sb.from("gz_participants").select("*").in("id", ids);
    const { data: statuses } = await sb.from("gz_player_status").select("*").eq("tournament_id", tid);
    const stMap = {}; for (const s of statuses || []) stMap[s.participant_id] = s;
    mgrPlayers = (parts || []).sort((a, b) => (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name))
      .map((p) => ({ p, st: stMap[p.id] || {} }));
    renderMgr();
  }
  $("gz-close-status").textContent = "";
  await loadFinances(tid);
  if (gzIsOfficial) loadResponsables(tid);
  $("gz-list-wrap").classList.add("hidden");
  $("gz-detail").classList.remove("hidden");
  window.scrollTo(0, 0);
}

function closeDetail() {
  $("gz-detail").classList.add("hidden");
  $("gz-list-wrap").classList.remove("hidden");
  loadTournaments();
}

async function loadResponsables(tid) {
  const { data: mgrs } = await sb.from("gz_managers").select("person_id").eq("tournament_id", tid);
  const ids = (mgrs || []).map((m) => m.person_id);
  const named = ids.length ? (await sb.from("people").select("id,first_name,last_name").in("id", ids)).data || [] : [];
  $("gz-resp-list").innerHTML = named.length
    ? named.map((p) => `<span class="gz-badge" style="background:var(--fluo-d);color:var(--fluo-ink)">${esc(p.last_name)} ${esc(p.first_name)} <b class="gz-resp-del" data-id="${p.id}" style="cursor:pointer">×</b></span>`).join(" ")
    : '<span class="muted" style="font-size:.85rem">Aucun responsable nommé.</span>';
  $("gz-resp-list").querySelectorAll(".gz-resp-del").forEach((b) =>
    b.addEventListener("click", async () => { await sb.from("gz_managers").delete().eq("tournament_id", tid).eq("person_id", b.dataset.id); loadResponsables(tid); loadFinances(tid); }));
  // liste des personnes (staff) à nommer
  if (!$("gz-resp-select").dataset.loaded) {
    const opts = people.filter((p) => p.id).map((p) => `<option value="${p.id}">${esc(p.last_name)} ${esc(p.first_name)}</option>`).join("");
    $("gz-resp-select").innerHTML = '<option value="">— choisir une personne —</option>' + opts;
    $("gz-resp-select").dataset.loaded = "1";
  }
}

async function addResponsable() {
  const pid = $("gz-resp-select").value;
  if (!pid) return;
  await sb.from("gz_managers").insert({ tournament_id: mgrTid, person_id: pid });
  $("gz-resp-select").value = "";
  loadResponsables(mgrTid); loadFinances(mgrTid);
}

function priceOpts() {
  const cat = mgrCats.find((c) => c.id === $("gz-mgr-cat").value);
  return cat && Array.isArray(cat.prices) ? cat.prices : [];
}

function renderMgr() {
  const opts = priceOpts();
  $("gz-mgr-players").innerHTML = mgrPlayers.map(({ p, st }) => {
    const amtOpts = ['<option value="">—</option>', '<option value="0">Gratuit</option>']
      .concat(opts.map((o) => `<option value="${o.amount}" ${Number(st.amount_paid) === Number(o.amount) ? "selected" : ""}>${esc(o.label)} — ${o.amount}</option>`)).join("");
    const method = (m) => `<option value="${m}" ${st.pay_method === m ? "selected" : ""}>${m}</option>`;
    return `<tr data-pid="${p.id}">
      <td><b>${esc(p.last_name)} ${esc(p.first_name)}</b>${st.is_winner ? " " + ICO_CUP : ""}</td>
      <td class="muted" style="font-size:.8rem">
        ${esc(p.club || "")}
        <div class="gz-credit-line">
          ${p.credit_chf > 0 ? `<b class="gz-credit">crédit ${p.credit_chf} CHF</b> <button type="button" class="gz-credit-use gz-mini">utiliser</button>` : ""}
          <button type="button" class="gz-credit-add gz-mini">+ crédit</button>
          <button type="button" class="gz-comment-edit gz-mini">✎ note</button>
        </div>
        ${p.comment ? `<div class="gz-comment">${esc(p.comment)}</div>` : ""}
      </td>
      <td style="text-align:center"><input type="checkbox" class="gz-absent" ${st.absent ? "checked" : ""} /></td>
      <td><select class="gz-amount" ${st.absent ? "disabled" : ""}>${amtOpts}</select></td>
      <td><select class="gz-method" ${st.absent ? "disabled" : ""}><option value="">méthode</option>${method("cash")}${method("twint")}${method("carte")}<option value="credit" ${st.pay_method === "credit" ? "selected" : ""}>crédit</option></select></td>
      <td class="gz-winner-cell" style="text-align:center">${mgrIsGz ? `
        <label title="Vainqueur"><input type="checkbox" class="gz-winner" ${st.is_winner ? "checked" : ""} /> ${ICO_CUP}</label>
        <div class="gz-photo-wrap" style="${st.is_winner ? "" : "display:none"}">
          ${st.photo_url ? `<img src="${st.photo_url}" class="gz-photo-thumb" />` : ""}
          <button type="button" class="gz-photo-btn">${st.photo_url ? "Refaire" : "Photo"}</button>
          <input type="file" accept="image/*" capture="environment" class="gz-photo-file" style="display:none" />
        </div>` : ""}</td>
    </tr>`;
  }).join("");
  $("gz-mgr-players").querySelectorAll("tr[data-pid]").forEach((tr) => {
    tr.querySelectorAll(".gz-absent,.gz-amount,.gz-method,.gz-winner").forEach((el) => el.addEventListener("change", () => saveStatus(tr)));
    const btn = tr.querySelector(".gz-photo-btn"), file = tr.querySelector(".gz-photo-file");
    if (btn && file) {
      btn.addEventListener("click", () => file.click());
      file.addEventListener("change", () => uploadPhoto(tr, file));
    }
    tr.querySelector(".gz-credit-add")?.addEventListener("click", () => grantCredit(tr.dataset.pid));
    tr.querySelector(".gz-credit-use")?.addEventListener("click", () => spendCredit(tr.dataset.pid));
    tr.querySelector(".gz-comment-edit")?.addEventListener("click", () => editComment(tr.dataset.pid));
  });
  updateMgrTotals();
}

function mgrPlayer(pid) { return mgrPlayers.find((x) => x.p.id === pid); }

async function grantCredit(pid) {
  const mp = mgrPlayer(pid); if (!mp) return;
  const v = prompt(`Ajouter un crédit à ${mp.p.first_name} (CHF) :`, "");
  const amt = Number(v);
  if (!amt) return;
  const nc = Number(mp.p.credit_chf || 0) + amt;
  await sb.from("gz_participants").update({ credit_chf: nc }).eq("id", pid);
  mp.p.credit_chf = nc;
  renderMgr();
}

async function spendCredit(pid) {
  const mp = mgrPlayer(pid); if (!mp) return;
  const credit = Number(mp.p.credit_chf || 0);
  if (credit <= 0) return;
  const v = prompt(`Montant du crédit à utiliser (max ${credit} CHF) :`, String(credit));
  const amt = Math.min(Number(v) || 0, credit);
  if (!amt) return;
  await sb.from("gz_participants").update({ credit_chf: credit - amt }).eq("id", pid);
  await sb.from("gz_player_status").upsert({
    tournament_id: mgrTid, participant_id: pid, absent: false,
    amount_paid: amt, pay_method: "credit", updated_at: new Date().toISOString(),
  }, { onConflict: "tournament_id,participant_id" });
  mp.p.credit_chf = credit - amt;
  mp.st = { ...mp.st, absent: false, amount_paid: amt, pay_method: "credit" };
  renderMgr();
}

async function editComment(pid) {
  const mp = mgrPlayer(pid); if (!mp) return;
  const v = prompt(`Note libre pour ${mp.p.first_name} ${mp.p.last_name} :`, mp.p.comment || "");
  if (v === null) return;
  await sb.from("gz_participants").update({ comment: v.trim() || null }).eq("id", pid);
  mp.p.comment = v.trim() || null;
  renderMgr();
}

async function uploadPhoto(tr, file) {
  if (!file.files || !file.files[0]) return;
  const pid = tr.dataset.pid;
  const f = file.files[0];
  const path = `${mgrTid}/${pid}-${Date.now()}.jpg`;
  const { error } = await sb.storage.from("gz-photos").upload(path, f, { upsert: true, contentType: f.type });
  if (error) { alert("Photo : " + error.message); return; }
  const url = sb.storage.from("gz-photos").getPublicUrl(path).data.publicUrl;
  await sb.from("gz_player_status").upsert({ tournament_id: mgrTid, participant_id: pid, photo_url: url, is_winner: true, updated_at: new Date().toISOString() }, { onConflict: "tournament_id,participant_id" });
  const wrap = tr.querySelector(".gz-photo-wrap");
  wrap.querySelector("img")?.remove();
  wrap.insertAdjacentHTML("afterbegin", `<img src="${url}" class="gz-photo-thumb" />`);
  tr.querySelector(".gz-photo-btn").textContent = "Refaire";
}

async function saveStatus(tr) {
  const pid = tr.dataset.pid;
  const absent = tr.querySelector(".gz-absent").checked;
  const amount = tr.querySelector(".gz-amount").value;
  const method = tr.querySelector(".gz-method").value;
  const winner = tr.querySelector(".gz-winner") ? tr.querySelector(".gz-winner").checked : false;
  tr.querySelector(".gz-amount").disabled = absent;
  tr.querySelector(".gz-method").disabled = absent;
  const wrap = tr.querySelector(".gz-photo-wrap");
  if (wrap) wrap.style.display = winner ? "" : "none";
  await sb.from("gz_player_status").upsert({
    tournament_id: mgrTid, participant_id: pid,
    absent, amount_paid: absent || amount === "" ? null : Number(amount),
    pay_method: absent || !method ? null : method, is_winner: winner, updated_at: new Date().toISOString(),
  }, { onConflict: "tournament_id,participant_id" });
  updateMgrTotals();
}

function updateMgrTotals() {
  const t = { cash: 0, twint: 0, carte: 0 };
  $("gz-mgr-players").querySelectorAll("tr[data-pid]").forEach((tr) => {
    if (tr.querySelector(".gz-absent").checked) return;
    const m = tr.querySelector(".gz-method").value;
    const a = Number(tr.querySelector(".gz-amount").value) || 0;
    if (m && t[m] !== undefined) t[m] += a;
  });
  const tot = t.cash + t.twint + t.carte;
  $("gz-mgr-totals").innerHTML =
    `<span>Cash : <b>${t.cash} CHF</b></span><span>Twint : <b>${t.twint} CHF</b></span><span>Carte : <b>${t.carte} CHF</b></span><span>Total : <b>${tot} CHF</b></span>`;
  mgrCashPlayers = t.cash;
  computeCaisse();
}

// ---- Finances du tournoi : paiements, salaires, caisse, clôture ----
let mgrPayments = [], mgrSalaries = [], mgrManagers = [], mgrCashPlayers = 0, mgrTillBalance = 0, mgrTournamentName = "";

async function loadFinances(tid) {
  const [{ data: pays }, { data: sals }, { data: caisse }, { data: mgrs }] = await Promise.all([
    sb.from("gz_payments").select("*").eq("tournament_id", tid).order("created_at"),
    sb.from("gz_salaries").select("*").eq("tournament_id", tid).order("created_at"),
    sb.from("gz_caisse").select("*").eq("tournament_id", tid).maybeSingle(),
    sb.from("gz_managers").select("person_id").eq("tournament_id", tid),
  ]);
  mgrPayments = pays || []; mgrSalaries = sals || [];
  const ids = (mgrs || []).map((m) => m.person_id);
  mgrManagers = ids.length ? (await sb.from("people").select("id,first_name,last_name").in("id", ids)).data || [] : [];
  $("gz-sal-person").innerHTML = '<option value="">— responsable —</option>' +
    mgrManagers.map((p) => `<option value="${p.id}">${esc(p.last_name)} ${esc(p.first_name)}</option>`).join("") +
    '<option value="autre">Autre (saisir)…</option>';
  const { data: bal } = await sb.rpc("gz_till_balance");
  mgrTillBalance = Number(bal) || 0;
  $("gz-caisse-start").value = mgrTillBalance;
  $("gz-caisse-counted").value = caisse?.counted_amount ?? "";
  renderPayments(); renderSalaries(); computeCaisse();
}

function renderPayments() {
  $("gz-pay-list").innerHTML = mgrPayments.length ? mgrPayments.map((p) =>
    `<div class="gz-fin-item"><span>${esc(p.label || "—")} — <b>${p.amount} CHF</b> · ${esc(p.method || "?")}</span><button type="button" class="gz-del-pay" data-id="${p.id}">✕</button></div>`).join("") : '<p class="muted" style="font-size:.85rem;margin:0">Aucun.</p>';
  $("gz-pay-list").querySelectorAll(".gz-del-pay").forEach((b) => b.onclick = () => delFin("gz_payments", b.dataset.id));
}
function renderSalaries() {
  const nameOf = (s) => s.name || mgrManagers.find((m) => m.id === s.person_id)?.last_name + " " + (mgrManagers.find((m) => m.id === s.person_id)?.first_name || "") || "—";
  $("gz-sal-list").innerHTML = mgrSalaries.length ? mgrSalaries.map((s) =>
    `<div class="gz-fin-item"><span>${esc(nameOf(s))} — <b>${s.amount} CHF</b></span><button type="button" class="gz-del-sal" data-id="${s.id}">✕</button></div>`).join("") : '<p class="muted" style="font-size:.85rem;margin:0">Aucun.</p>';
  $("gz-sal-list").querySelectorAll(".gz-del-sal").forEach((b) => b.onclick = () => delFin("gz_salaries", b.dataset.id));
}
async function addPayment() {
  const amount = Number($("gz-pay-amount").value);
  if (!amount) return;
  await sb.from("gz_payments").insert({ tournament_id: mgrTid, label: $("gz-pay-label").value.trim() || null, amount, method: $("gz-pay-method").value });
  $("gz-pay-label").value = ""; $("gz-pay-amount").value = "";
  mgrPayments = (await sb.from("gz_payments").select("*").eq("tournament_id", mgrTid).order("created_at")).data || [];
  renderPayments(); computeCaisse();
}
async function addSalary() {
  const amount = Number($("gz-sal-amount").value);
  if (!amount) return;
  const sel = $("gz-sal-person").value;
  let row = { tournament_id: mgrTid, amount };
  if (sel === "autre") { const n = prompt("Nom du responsable :"); if (!n) return; row.name = n; }
  else if (sel) row.person_id = sel;
  else { alert("Choisissez un responsable."); return; }
  await sb.from("gz_salaries").insert(row);
  $("gz-sal-amount").value = "";
  mgrSalaries = (await sb.from("gz_salaries").select("*").eq("tournament_id", mgrTid).order("created_at")).data || [];
  renderSalaries(); computeCaisse();
}
async function delFin(table, id) {
  await sb.from(table).delete().eq("id", id);
  if (table === "gz_payments") { mgrPayments = mgrPayments.filter((x) => x.id !== id); renderPayments(); }
  else { mgrSalaries = mgrSalaries.filter((x) => x.id !== id); renderSalaries(); }
  computeCaisse();
}
async function saveCaisse() {
  await sb.from("gz_caisse").upsert({
    tournament_id: mgrTid, start_amount: numOrNull($("gz-caisse-start").value),
    counted_amount: numOrNull($("gz-caisse-counted").value), updated_at: new Date().toISOString(),
  }, { onConflict: "tournament_id" });
  computeCaisse();
}
const numOrNull = (v) => v === "" ? null : Number(v);

function caisseNumbers() {
  const start = Number($("gz-caisse-start").value) || 0;
  const counted = $("gz-caisse-counted").value === "" ? null : Number($("gz-caisse-counted").value);
  const cashPay = mgrPayments.filter((p) => p.method === "cash").reduce((a, p) => a + Number(p.amount || 0), 0);
  const cashOut = mgrSalaries.reduce((a, s) => a + Number(s.amount || 0), 0);
  const expected = start + mgrCashPlayers + cashPay - cashOut;
  return { start, counted, cashIn: mgrCashPlayers + cashPay, cashOut, expected, diff: counted === null ? null : counted - expected };
}
function computeCaisse() {
  if (!$("gz-caisse-calc")) return;
  const c = caisseNumbers();
  $("gz-caisse-calc").innerHTML =
    `Cash encaissé : ${c.cashIn} · Salaires (sortie) : ${c.cashOut} · <b>Caisse attendue : ${c.expected} CHF</b>` +
    (c.counted === null ? "" : ` · Compté : ${c.counted} · Écart : <b style="color:${c.diff === 0 ? "#0b6b3a" : "#b3261e"}">${c.diff > 0 ? "+" : ""}${c.diff} CHF</b>`);
}

async function closeTournament() {
  const rows = [...$("gz-mgr-players").querySelectorAll("tr[data-pid]")];
  const unresolved = rows.filter((tr) => !tr.querySelector(".gz-absent").checked && tr.querySelector(".gz-amount").value === "").length;
  if (unresolved > 0) { alert(`${unresolved} joueur(s) ne sont ni payés ni marqués « absent ». Impossible de clôturer — complétez-les d'abord.`); return; }
  const winnersNoPhoto = rows.filter((tr) => tr.querySelector(".gz-winner")?.checked && !tr.querySelector(".gz-photo-wrap img")).length;
  const c = caisseNumbers();
  let warn = "";
  if (mgrIsGz && winnersNoPhoto > 0) warn += `\n• ${winnersNoPhoto} vainqueur(s) sans photo.`;
  if (c.counted !== null && c.diff !== 0) warn += `\n• La caisse comptée ne correspond pas (écart ${c.diff > 0 ? "+" : ""}${c.diff} CHF).`;
  if (warn && !confirm("Attention :" + warn + "\n\nClôturer le tournoi quand même ?")) return;
  const { data: cz } = await sb.from("gz_caisse").select("closed").eq("tournament_id", mgrTid).maybeSingle();
  await saveCaisse();
  if (!cz?.closed) {
    // Passe par une fonction SECURITY DEFINER : le responsable du tournoi peut
    // poster ce mouvement de clôture sans avoir un accès général à la caisse.
    const { error: ce } = await sb.rpc("gz_add_tournament_caisse", { p_tournament: mgrTid, p_amount: c.cashIn - c.cashOut, p_label: mgrTournamentName });
    if (ce) { alert("Caisse : " + ce.message); return; }
  }
  await sb.from("gz_caisse").update({ closed: true, closed_at: new Date().toISOString() }).eq("tournament_id", mgrTid);
  await sb.from("gz_tournaments").update({ status: "Clôturé" }).eq("id", mgrTid);
  $("gz-close-status").textContent = "✓ Tournoi clôturé.";
  setTimeout(closeDetail, 1400);
}

// ---- Caisse transverse (grand livre) ----
async function loadCaisseTab() {
  const { data: led } = await sb.from("gz_caisse_ledger").select("*").order("created_at", { ascending: true });
  const rows = led || [];
  let run = 0;
  const withRun = rows.map((r) => { run += Number(r.amount); return { ...r, run }; });
  $("gz-till-balance").textContent = run + " CHF";
  $("gz-ledger-rows").innerHTML = withRun.length ? withRun.slice().reverse().map((r) =>
    `<tr><td>${frDate(r.created_at)}</td><td>${esc(r.label || "—")}</td>
      <td style="font-weight:700;color:${r.amount >= 0 ? "#0b6b3a" : "#b3261e"}">${r.amount >= 0 ? "+" : ""}${r.amount}</td>
      <td>${r.run}</td><td><button type="button" class="fam-del gz-mov-del" data-id="${r.id}">✕</button></td></tr>`).join("")
    : '<tr><td colspan="5" class="muted">Aucun mouvement.</td></tr>';
  $("gz-ledger-rows").querySelectorAll(".gz-mov-del").forEach((b) =>
    b.addEventListener("click", async () => { if (confirm("Supprimer ce mouvement de caisse ?")) { await sb.from("gz_caisse_ledger").delete().eq("id", b.dataset.id); loadCaisseTab(); } }));
}

async function addMovement() {
  const amount = Number($("gz-mov-amount").value);
  if (!amount) { alert("Montant requis (positif pour une entrée, négatif pour une sortie)."); return; }
  await sb.from("gz_caisse_ledger").insert({ label: $("gz-mov-label").value.trim() || null, amount, created_by: meId });
  $("gz-mov-label").value = ""; $("gz-mov-amount").value = "";
  loadCaisseTab();
}

// ---- Tous les participants ----
let gzParts = [], gzPartSort = "last";

async function loadParticipantsTab() {
  const [{ data: parts }, { data: stats }] = await Promise.all([
    sb.from("gz_participants").select("*"),
    sb.from("gz_participant_stats").select("*"),
  ]);
  const sMap = {}; for (const s of stats || []) sMap[s.participant_id] = s;
  gzParts = (parts || []).map((p) => ({ ...p, part: sMap[p.id]?.participations || 0, vic: sMap[p.id]?.victoires || 0 }));
  renderParts();
}

function renderParts() {
  const q = $("gz-part-search").value.trim().toLowerCase();
  let rows = gzParts.filter((p) => !q ||
    `${p.last_name} ${p.first_name} ${p.email || ""} ${p.phone || ""} ${p.city || ""} ${p.club || ""} ${p.comment || ""}`.toLowerCase().includes(q));
  const val = (p) => ({ last: p.last_name, first: p.first_name, email: p.email, birth: p.birthdate,
    phone: p.phone, part: p.part, vic: p.vic, credit: Number(p.credit_chf || 0), comment: p.comment }[gzPartSort]);
  rows = rows.slice().sort((a, b) => {
    const x = val(a), y = val(b);
    if (["part", "vic", "credit"].includes(gzPartSort)) return (y || 0) - (x || 0);
    return String(x || "").localeCompare(String(y || ""));
  });
  $("gz-part-rows").innerHTML = rows.map((p) => `<tr>
    <td>${esc(p.last_name)}</td><td>${esc(p.first_name)}</td><td>${esc(p.email || "")}</td>
    <td>${p.birthdate || ""}</td><td>${esc(p.phone || "")}</td>
    <td>${p.part}</td><td>${p.vic > 0 ? ICO_CUP + " " + p.vic : "0"}</td>
    <td>${p.credit_chf > 0 ? p.credit_chf + " CHF" : ""}</td><td class="muted" style="font-size:.82rem">${esc(p.comment || "")}</td></tr>`).join("");
  $("gz-part-count").textContent = `${rows.length} participant(s)`;
}

// ---- Résumé financier ----
let gzFin = [], gzFinMgrs = {}, gzFinSeasonsLoaded = false;

async function loadFinanceTab() {
  const [{ data: fin }, { data: mgrs }, { data: seasons }] = await Promise.all([
    sb.from("gz_tournament_finance").select("*"),
    sb.from("gz_managers").select("tournament_id,person_id"),
    sb.from("gz_seasons").select("id,name,start_date,end_date").order("start_date", { ascending: false }),
  ]);
  const nameOf = (pid) => { const p = people.find((x) => x.id === pid); return p ? `${p.last_name} ${p.first_name}` : ""; };
  gzFinMgrs = {};
  for (const m of mgrs || []) { (gzFinMgrs[m.tournament_id] || (gzFinMgrs[m.tournament_id] = [])).push(nameOf(m.person_id)); }
  gzFin = fin || [];
  if (!gzFinSeasonsLoaded) {
    $("gz-fin-season").innerHTML = '<option value="">Toutes les saisons</option>' +
      (seasons || []).map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
    gzFinSeasonsLoaded = true;
  }
  renderFinance();
}

function renderFinance() {
  const sid = $("gz-fin-season").value;
  const rows = gzFin.filter((r) => !sid || r.season_id === sid)
    .sort((a, b) => String(b.tournament_date || "").localeCompare(String(a.tournament_date || "")));
  const T = { presents: 0, twint: 0, cash: 0, carte: 0, total: 0, salaires: 0, net: 0 };
  const html = rows.map((r) => {
    const twint = Number(r.twint), cash = Number(r.cash), carte = Number(r.carte), sal = Number(r.salaires);
    const total = twint + cash + carte, net = total - sal;
    T.presents += r.presents; T.twint += twint; T.cash += cash; T.carte += carte; T.total += total; T.salaires += sal; T.net += net;
    return `<tr><td>${esc(r.name || "—")}</td><td>${r.tournament_date || "—"}</td><td>${r.presents}</td>
      <td>${twint}</td><td>${cash}</td><td>${carte}</td><td><b>${total}</b></td><td>${sal}</td><td>${net}</td>
      <td class="muted" style="font-size:.8rem">${(gzFinMgrs[r.tournament_id] || []).join(", ")}</td></tr>`;
  }).join("");
  $("gz-fin-rows").innerHTML = html || '<tr><td colspan="10" class="muted">Aucun tournoi.</td></tr>';
  $("gz-fin-totals").innerHTML =
    `<td colspan="2">TOTAL — ${rows.length} tournoi(s)</td><td>${T.presents}</td><td>${T.twint}</td><td>${T.cash}</td><td>${T.carte}</td><td>${T.total}</td><td>${T.salaires}</td><td>${T.net}</td><td></td>`;
}

// ---- Communication : modèles d'e-mails ----
let gzMails = [];

async function loadMailTab() {
  const { data } = await sb.from("gz_email_templates").select("*").order("sort_order");
  gzMails = data || [];
  renderMailCards();
}

function renderMailCards() {
  $("gz-mail-list").innerHTML = gzMails.map((m) => `
    <div class="gz-mail-card" data-key="${m.key}">
      <div class="gz-mail-head">
        <b>${esc(m.name)}</b>
        <label class="gz-mail-en"><input type="checkbox" class="gz-mail-enabled" ${m.enabled ? "checked" : ""}/> Actif</label>
      </div>
      <div class="muted" style="font-size:.82rem;margin-bottom:.4rem">⏱ ${esc(m.trigger_desc || "")}</div>
      <label class="gz-mail-lbl">Objet</label>
      <input type="text" class="gz-mail-subject" value="${esc(m.subject || "")}"/>
      <label class="gz-mail-lbl">Message</label>
      <textarea class="gz-mail-body" rows="9">${esc(m.body || "")}</textarea>
      <div class="gz-mail-foot">
        <div class="gz-mail-img">
          ${m.image_url ? `<img src="${m.image_url}" class="gz-mail-thumb"/>` : ""}
          <button type="button" class="ghost gz-mail-imgbtn">${m.image_url ? "Changer l'image" : "Ajouter une image (plan, etc.)"}</button>
          ${m.image_url ? `<button type="button" class="ghost gz-mail-imgdel">Retirer</button>` : ""}
          <input type="file" accept="image/*" class="gz-mail-file hidden"/>
        </div>
        <button type="button" class="primary gz-mail-save">Enregistrer</button>
      </div>
    </div>`).join("");
  $("gz-mail-list").querySelectorAll(".gz-mail-card").forEach((card) => {
    const key = card.dataset.key;
    card.querySelector(".gz-mail-save").addEventListener("click", () => saveMail(key, card));
    const file = card.querySelector(".gz-mail-file");
    card.querySelector(".gz-mail-imgbtn").addEventListener("click", () => file.click());
    file.addEventListener("change", () => uploadMailImage(key, file));
    card.querySelector(".gz-mail-imgdel")?.addEventListener("click", () => removeMailImage(key));
  });
}

async function saveMail(key, card) {
  const patch = {
    subject: card.querySelector(".gz-mail-subject").value.trim(),
    body: card.querySelector(".gz-mail-body").value,
    enabled: card.querySelector(".gz-mail-enabled").checked,
    updated_at: new Date().toISOString(),
  };
  const btn = card.querySelector(".gz-mail-save");
  btn.textContent = "…";
  const { error } = await sb.from("gz_email_templates").update(patch).eq("key", key);
  btn.textContent = error ? "Erreur" : "Enregistré ✓";
  if (!error) { const m = gzMails.find((x) => x.key === key); if (m) Object.assign(m, patch); }
  setTimeout(() => (btn.textContent = "Enregistrer"), 1500);
}

async function uploadMailImage(key, file) {
  if (!file.files || !file.files[0]) return;
  const f = file.files[0];
  const path = `templates/${key}-${Date.now()}`;
  const { error } = await sb.storage.from("gz-photos").upload(path, f, { upsert: true, contentType: f.type });
  if (error) { alert("Image : " + error.message); return; }
  const url = sb.storage.from("gz-photos").getPublicUrl(path).data.publicUrl;
  await sb.from("gz_email_templates").update({ image_url: url }).eq("key", key);
  const m = gzMails.find((x) => x.key === key); if (m) m.image_url = url;
  renderMailCards();
}

async function removeMailImage(key) {
  await sb.from("gz_email_templates").update({ image_url: null }).eq("key", key);
  const m = gzMails.find((x) => x.key === key); if (m) m.image_url = null;
  renderMailCards();
}

// ---- Sondages (moteur générique : GameZone + Stages) ----
const SITE_ORIGIN = location.origin;
const SURVEY_CFG = {
  gamezone: { listId: "gz-survey-list", newTag: null },
  stage:    { listId: "stg-survey-list", newTag: "stage" },
};
const surveyState = { gamezone: { list: [], q: {} }, stage: { list: [], q: {} } };

async function loadSurveyTab(scope) {
  const [{ data: surveys }, { data: qs }] = await Promise.all([
    sb.from("gz_surveys").select("*").order("created_at", { ascending: false }),
    sb.from("gz_survey_questions").select("*").order("position"),
  ]);
  const all = surveys || [];
  const list = scope === "stage" ? all.filter((s) => s.tag === "stage") : all.filter((s) => s.tag !== "stage");
  const q = {};
  for (const qq of qs || []) (q[qq.survey_id] || (q[qq.survey_id] = [])).push(qq);
  surveyState[scope] = { list, q };
  renderSurveys(scope);
}

function renderSurveys(scope) {
  const L = $(SURVEY_CFG[scope].listId);
  const { list, q: qmap } = surveyState[scope];
  if (!list.length) { L.innerHTML = '<p class="muted">Aucun questionnaire. Clique « + Nouveau ».</p>'; return; }
  L.innerHTML = list.map((s) => {
    const qs = qmap[s.id] || [];
    const link = `${SITE_ORIGIN}/sondage.html?s=${s.id}`;
    const qhtml = qs.map((q) => {
      const opts = q.qtype === "choice" ? ` <span class="muted">(${(q.options || []).map(esc).join(" · ")})</span>` : q.qtype === "rating" ? ' <span class="muted">(note 1–5)</span>' : ' <span class="muted">(texte libre)</span>';
      return `<li>${esc(q.label)}${opts} <button class="fam-del gz-q-del" data-id="${q.id}">✕</button></li>`;
    }).join("");
    return `<div class="gz-survey-card" data-id="${s.id}">
      <div class="gz-mail-head">
        <input type="text" class="gz-survey-title" value="${esc(s.title)}" style="font-weight:800;flex:1;margin-right:10px"/>
        <label class="gz-mail-en"><input type="checkbox" class="gz-survey-active" ${s.active ? "checked" : ""}/> Actif</label>
      </div>
      <label class="gz-mail-lbl">Intro (optionnel)</label>
      <input type="text" class="gz-survey-intro" value="${esc(s.intro || "")}"/>
      <label class="gz-mail-lbl">Questions</label>
      <ol class="gz-survey-qs">${qhtml || '<li class="muted">Aucune question.</li>'}</ol>
      <button class="ghost gz-q-add" data-id="${s.id}">+ Ajouter une question</button>
      <div class="gz-mail-foot">
        <div class="muted" style="font-size:.8rem">Lien : <a href="${link}" target="_blank" rel="noopener">${link}</a></div>
        <div style="display:flex;gap:8px">
          <button class="ghost gz-survey-results" data-id="${s.id}">Résultats</button>
          <button class="primary gz-survey-save" data-id="${s.id}">Enregistrer</button>
          <button class="fam-del gz-survey-del" data-id="${s.id}">Supprimer</button>
        </div>
      </div>
      <div class="gz-survey-res hidden" id="gz-res-${s.id}"></div>
    </div>`;
  }).join("");
  L.querySelectorAll(".gz-survey-save").forEach((b) => b.addEventListener("click", () => saveSurvey(scope, b.dataset.id)));
  L.querySelectorAll(".gz-survey-del").forEach((b) => b.addEventListener("click", () => delSurvey(scope, b.dataset.id)));
  L.querySelectorAll(".gz-q-add").forEach((b) => b.addEventListener("click", () => addQuestion(scope, b.dataset.id)));
  L.querySelectorAll(".gz-q-del").forEach((b) => b.addEventListener("click", () => delQuestion(scope, b.dataset.id)));
  L.querySelectorAll(".gz-survey-results").forEach((b) => b.addEventListener("click", () => showSurveyResults(scope, b.dataset.id)));
}

async function createSurvey(scope) {
  const title = prompt("Titre du questionnaire :", "Questionnaire de satisfaction");
  if (!title) return;
  const { error } = await sb.from("gz_surveys").insert({ title, tag: SURVEY_CFG[scope].newTag });
  if (error) return alert(error.message);
  loadSurveyTab(scope);
}

async function saveSurvey(scope, id) {
  const card = $(SURVEY_CFG[scope].listId).querySelector(`.gz-survey-card[data-id="${id}"]`);
  const patch = {
    title: card.querySelector(".gz-survey-title").value.trim(),
    intro: card.querySelector(".gz-survey-intro").value.trim() || null,
    active: card.querySelector(".gz-survey-active").checked,
  };
  const btn = card.querySelector(".gz-survey-save");
  btn.textContent = "…";
  const { error } = await sb.from("gz_surveys").update(patch).eq("id", id);
  btn.textContent = error ? "Erreur" : "Enregistré ✓";
  if (!error) Object.assign(surveyState[scope].list.find((x) => x.id === id), patch);
  setTimeout(() => (btn.textContent = "Enregistrer"), 1500);
}

async function delSurvey(scope, id) {
  if (!confirm("Supprimer ce questionnaire et toutes ses réponses ?")) return;
  await sb.from("gz_surveys").delete().eq("id", id);
  loadSurveyTab(scope);
}

async function addQuestion(scope, sid) {
  const label = prompt("Question :");
  if (!label) return;
  const t = (prompt("Type — tape : choix / texte / note", "choix") || "").toLowerCase().trim();
  const qtype = t.startsWith("t") ? "text" : t.startsWith("n") ? "rating" : "choice";
  let options = [];
  if (qtype === "choice") {
    const o = prompt("Réponses possibles, séparées par des virgules :", "Oui, Non");
    options = (o || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (!options.length) return alert("Au moins une réponse est nécessaire.");
  }
  const pos = (surveyState[scope].q[sid] || []).length;
  const { error } = await sb.from("gz_survey_questions").insert({ survey_id: sid, label, qtype, options, position: pos });
  if (error) return alert(error.message);
  loadSurveyTab(scope);
}

async function delQuestion(scope, qid) {
  if (!confirm("Supprimer cette question ?")) return;
  await sb.from("gz_survey_questions").delete().eq("id", qid);
  loadSurveyTab(scope);
}

async function showSurveyResults(scope, sid) {
  const box = $("gz-res-" + sid);
  if (!box.classList.contains("hidden")) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  box.innerHTML = '<p class="muted">Chargement…</p>';
  const [{ data: resp }, { data: ans }] = await Promise.all([
    sb.from("gz_survey_responses").select("id,submitted_at,tournament_id").eq("survey_id", sid),
    sb.from("gz_survey_answers").select("question_id,value,response_id"),
  ]);
  const respIds = new Set((resp || []).map((r) => r.id));
  const answers = (ans || []).filter((a) => respIds.has(a.response_id));
  box.dataset.resp = JSON.stringify(resp || []);
  box.dataset.ans = JSON.stringify(answers);
  const dates = (resp || []).map((r) => r.submitted_at).sort();
  const min = dates[0] ? dates[0].slice(0, 10) : "";
  const max = dates[dates.length - 1] ? dates[dates.length - 1].slice(0, 10) : "";
  box.innerHTML = `
    <div class="gz-res-filter">
      <label>Du <input type="date" class="gz-res-from" value="${min}"/></label>
      <label>au <input type="date" class="gz-res-to" value="${max}"/></label>
    </div>
    <div class="gz-res-body"></div>`;
  const redraw = () => renderSurveyResults(scope, sid, box);
  box.querySelector(".gz-res-from").addEventListener("change", redraw);
  box.querySelector(".gz-res-to").addEventListener("change", redraw);
  redraw();
}

function renderSurveyResults(scope, sid, box) {
  const resp = JSON.parse(box.dataset.resp || "[]");
  const answers = JSON.parse(box.dataset.ans || "[]");
  const from = box.querySelector(".gz-res-from").value;
  const to = box.querySelector(".gz-res-to").value;
  const inRange = (d) => (!from || d.slice(0, 10) >= from) && (!to || d.slice(0, 10) <= to);
  const okResp = new Set(resp.filter((r) => inRange(r.submitted_at)).map((r) => r.id));
  const okAns = answers.filter((a) => okResp.has(a.response_id));
  const qs = surveyState[scope].q[sid] || [];
  let html = `<p><b>${okResp.size}</b> sondage(s) rempli(s) sur la période.</p>`;
  for (const q of qs) {
    const qa = okAns.filter((a) => a.question_id === q.id);
    html += `<div class="gz-res-q"><b>${esc(q.label)}</b>`;
    if (q.qtype === "choice" || q.qtype === "rating") {
      const buckets = q.qtype === "rating" ? ["1", "2", "3", "4", "5"] : (q.options || []);
      const counts = {}; qa.forEach((a) => (counts[a.value] = (counts[a.value] || 0) + 1));
      const tot = qa.length || 1;
      html += "<ul class='gz-res-bars'>" + buckets.map((opt) => {
        const c = counts[opt] || 0; const pct = Math.round((c / tot) * 100);
        return `<li><span class="gz-res-lbl">${esc(opt)}</span><span class="gz-res-bar"><span style="width:${pct}%"></span></span><span class="gz-res-n">${c} (${pct}%)</span></li>`;
      }).join("") + "</ul>";
    } else {
      html += qa.length ? "<ul class='gz-res-txt'>" + qa.map((a) => `<li>${esc(a.value || "")}</li>`).join("") + "</ul>" : '<p class="muted">Aucune réponse.</p>';
    }
    html += "</div>";
  }
  box.querySelector(".gz-res-body").innerHTML = html;
}

// ---- Site public : gestion des photos de vainqueurs ----
let gzSitePhotos = [], gzSiteSeasonsLoaded = false;

async function loadSiteTab() {
  const [{ data: st }, { data: seasons }] = await Promise.all([
    sb.from("gz_player_status")
      .select("participant_id,tournament_id,photo_url,photo_public,updated_at,gz_participants(first_name,last_name),gz_tournaments(name,tournament_date,season_id,is_gamezone)")
      .eq("is_winner", true).not("photo_url", "is", null),
    sb.from("gz_seasons").select("id,name,start_date").order("start_date", { ascending: false }),
  ]);
  gzSitePhotos = (st || []).filter((r) => r.gz_tournaments?.is_gamezone);
  if (!gzSiteSeasonsLoaded) {
    $("gz-site-season").innerHTML = '<option value="">Toutes les saisons</option>' +
      (seasons || []).map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
    $("gz-site-season").addEventListener("change", renderSitePhotos);
    gzSiteSeasonsLoaded = true;
  }
  renderSitePhotos();
}

function renderSitePhotos() {
  const sid = $("gz-site-season").value;
  const rows = gzSitePhotos
    .filter((r) => !sid || r.gz_tournaments?.season_id === sid)
    .sort((a, b) => String(b.gz_tournaments?.tournament_date || "").localeCompare(String(a.gz_tournaments?.tournament_date || "")));
  if (!rows.length) { $("gz-site-photos").innerHTML = '<p class="muted">Aucune photo de vainqueur.</p>'; return; }
  $("gz-site-photos").innerHTML = rows.map((r) => {
    const p = r.gz_participants || {}, t = r.gz_tournaments || {};
    const hidden = !r.photo_public;
    return `<div class="gz-site-card${hidden ? " off" : ""}" data-tid="${r.tournament_id}" data-pid="${r.participant_id}">
      <img src="${esc(r.photo_url)}" alt="" />
      <div class="gz-site-meta">
        <b>${esc(p.first_name || "")} ${esc(p.last_name || "")}</b>
        <span class="muted">${esc(t.name || "")}${t.tournament_date ? " · " + t.tournament_date : ""}</span>
      </div>
      <button class="ghost gz-site-toggle">${hidden ? "Afficher" : "Retirer du public"}</button>
      ${hidden ? '<span class="gz-site-badge">Masquée</span>' : ""}
    </div>`;
  }).join("");
  $("gz-site-photos").querySelectorAll(".gz-site-toggle").forEach((b) =>
    b.addEventListener("click", () => toggleSitePhoto(b.closest(".gz-site-card"))));
}

async function toggleSitePhoto(card) {
  const tid = card.dataset.tid, pid = card.dataset.pid;
  const row = gzSitePhotos.find((r) => r.tournament_id === tid && r.participant_id === pid);
  const next = !row.photo_public;
  const btn = card.querySelector(".gz-site-toggle");
  btn.textContent = "…";
  const { error } = await sb.from("gz_player_status").update({ photo_public: next })
    .eq("tournament_id", tid).eq("participant_id", pid);
  if (error) { btn.textContent = "Erreur"; return; }
  row.photo_public = next;
  renderSitePhotos();
}

async function loadSeasons() {
  const { data } = await sb.from("gz_seasons").select("*").order("start_date", { ascending: false });
  const rows = data || [];
  $("gz-seasons-rows").innerHTML = rows.length ? rows.map((s) => {
    const weeks = Math.round((new Date(s.end_date) - new Date(s.start_date)) / 86400000 / 7 * 10) / 10;
    return `<tr>
      <td>${esc(s.name)}</td><td>${frDate(s.start_date)}</td><td>${frDate(s.end_date)}</td><td>${weeks}</td>
      <td>${s.is_current ? "✓ courante" : `<button class="ghost gz-set-cur" data-id="${s.id}">définir</button>`}</td>
      <td><button class="fam-del gz-del-season" data-id="${s.id}">✕</button></td></tr>`;
  }).join("") : '<tr><td colspan="6" class="muted">Aucune saison.</td></tr>';
  $("gz-seasons-rows").querySelectorAll(".gz-set-cur").forEach((b) => b.addEventListener("click", () => setCurrentSeason(b.dataset.id)));
  $("gz-seasons-rows").querySelectorAll(".gz-del-season").forEach((b) => b.addEventListener("click", () => delSeason(b.dataset.id)));
}

async function createSeason() {
  const name = prompt("Nom de la saison (ex. GameZone 2025/26) :");
  if (!name) return;
  const start = prompt("Date de début (AAAA-MM-JJ) :");
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return alert("Date de début invalide.");
  const end = prompt("Date de fin (AAAA-MM-JJ) :");
  if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return alert("Date de fin invalide.");
  const { error } = await sb.from("gz_seasons").insert({ name, start_date: start, end_date: end });
  if (error) return alert(error.message);
  loadSeasons();
}

async function setCurrentSeason(id) {
  await sb.from("gz_seasons").update({ is_current: false }).neq("id", id);
  await sb.from("gz_seasons").update({ is_current: true }).eq("id", id);
  loadSeasons();
}

async function delSeason(id) {
  if (!confirm("Supprimer cette saison ?")) return;
  await sb.from("gz_seasons").delete().eq("id", id);
  loadSeasons();
}

async function loadCats() {
  const { data } = await sb.from("gz_price_categories").select("*").order("created_at");
  $("gz-cats").innerHTML = (data || []).map(catCardHTML).join("") || '<p class="muted">Aucune catégorie.</p>';
  document.querySelectorAll(".gz-cat").forEach(wireCatCard);
}

function catCardHTML(c) {
  const prices = Array.isArray(c.prices) ? c.prices : [];
  const rows = prices.map((p, i) => priceRowHTML(p.label, p.amount, i)).join("");
  return `<div class="gz-cat rg-card" data-id="${c.id}" style="background:#f5f7fb">
    <input class="gz-cat-name" value="${esc(c.name)}" style="font-weight:800;max-width:340px" />
    <table class="crm-table" style="margin:10px 0"><thead><tr><th>Libellé du prix</th><th>Montant (CHF)</th><th></th></tr></thead>
      <tbody class="gz-price-rows">${rows}</tbody></table>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button type="button" class="ghost gz-add-price">+ Prix</button>
      <span class="spacer" style="flex:1"></span>
      <button type="button" class="danger gz-del-cat">Supprimer</button>
      <button type="button" class="gz-save-cat">Enregistrer</button>
    </div></div>`;
}
function priceRowHTML(label, amount, i) {
  return `<tr><td><input class="gz-plabel" value="${esc(label || "")}" /></td>
    <td><input class="gz-pamount" type="number" min="0" value="${amount ?? 0}" style="width:90px" /></td>
    <td><button type="button" class="fam-del gz-del-price">✕</button></td></tr>`;
}
function wireCatCard(card) {
  card.querySelector(".gz-add-price").addEventListener("click", () => {
    card.querySelector(".gz-price-rows").insertAdjacentHTML("beforeend", priceRowHTML("", 0));
    card.querySelectorAll(".gz-del-price").forEach((b) => b.onclick = () => b.closest("tr").remove());
  });
  card.querySelectorAll(".gz-del-price").forEach((b) => b.onclick = () => b.closest("tr").remove());
  card.querySelector(".gz-save-cat").addEventListener("click", () => saveCat(card));
  card.querySelector(".gz-del-cat").addEventListener("click", () => delCat(card.dataset.id));
}

async function saveCat(card) {
  const name = card.querySelector(".gz-cat-name").value.trim();
  const prices = [...card.querySelectorAll(".gz-price-rows tr")].map((tr) => ({
    label: tr.querySelector(".gz-plabel").value.trim(),
    amount: Number(tr.querySelector(".gz-pamount").value),
  })).filter((p) => p.label);
  const { error } = await sb.from("gz_price_categories").update({ name, prices }).eq("id", card.dataset.id);
  const btn = card.querySelector(".gz-save-cat");
  btn.textContent = error ? "Erreur" : "✓ Enregistré";
  setTimeout(() => (btn.textContent = "Enregistrer"), 1500);
}

async function createCat() {
  const name = prompt("Nom de la catégorie de tarifs :");
  if (!name) return;
  await sb.from("gz_price_categories").insert({ name, prices: [] });
  loadCats();
}

async function delCat(id) {
  if (!confirm("Supprimer cette catégorie de tarifs ?")) return;
  await sb.from("gz_price_categories").delete().eq("id", id);
  loadCats();
}

function renderChips(containerId, items, selected) {
  const set = new Set(selected || []);
  $(containerId).innerHTML = items.map(([val, label]) =>
    `<button type="button" class="chip ${set.has(String(val)) ? "sel" : ""}" data-val="${val}">${esc(label)}</button>`).join("");
  $(containerId).querySelectorAll(".chip").forEach((c) =>
    c.addEventListener("click", () => c.classList.toggle("sel")));
}
const chipValues = (id) => [...document.querySelectorAll("#" + id + " .chip.sel")].map((c) => c.dataset.val);
function updateCount() {
  $("c-count").textContent = `(${chipValues("c-children").length} / 30)`;
}

function openCourse(course, related) {
  $("c-error").hidden = true;
  $("course-title").textContent = course ? "Modifier le cours" : "Nouveau cours";
  $("c-id").value = course?.id || "";
  $("c-type").value = course?.course_type_id || "";
  $("c-label").value = course?.title || "";
  $("c-date").value = course?.course_date || $("cs-date").value;
  $("c-start").value = course ? course.start_time.slice(0, 5) : "17:00";
  $("c-end").value = course ? course.end_time.slice(0, 5) : "18:00";
  $("c-color").value = course?.color || "#0b6b3a";
  renderChips("c-courts", resaCourtsAll.map((c) => [c.id, c.name.replace("Court ", "C")]), related?.courts);
  renderChips("c-coaches", people.filter((p) => hasRoleIn(p.id, COACH_ROLES)).map((p) => [p.id, `${p.last_name} ${p.first_name}`]), related?.coaches);
  renderChips("c-children", people.filter((p) => hasRoleIn(p.id, COURSE_ROLES)).map((p) => [p.id, `${p.last_name} ${p.first_name}`]), related?.children);
  updateCount();
  $("c-del").classList.toggle("hidden", !course);
  // Présences (seulement en édition d'un cours existant)
  $("c-att-block").classList.toggle("hidden", !course);
  if (course) renderCourseAtt(course, related?.coaches || [], related?.children || [], related?.attendance || []);
  $("course-modal").classList.remove("hidden");
}

function renderCourseAtt(course, coachIds, childIds, att) {
  const statusOf = (pid) => att.find((a) => a.person_id === pid)?.status || "";
  $("c-att").innerHTML = attCol(course, coachIds, coachIds, true, "Coachs", statusOf)
    + attCol(course, coachIds, childIds, false, "Élèves", statusOf);
  $("c-att").querySelectorAll(".att-chip").forEach((ch) => ch.addEventListener("click", () => cycleAtt(ch)));
}

async function editCourse(id) {
  const course = (await sb.from("courses").select("*").eq("id", id).single()).data;
  const [courts, coaches, children, attendance] = await Promise.all([
    sb.from("court_bookings").select("court_id").eq("course_id", id).then((r) => (r.data || []).map((x) => String(x.court_id))),
    sb.from("course_coaches").select("coach_person_id").eq("course_id", id).then((r) => (r.data || []).map((x) => x.coach_person_id)),
    sb.from("course_participants").select("child_person_id").eq("course_id", id).then((r) => (r.data || []).map((x) => x.child_person_id)),
    sb.from("attendance").select("person_id,status").eq("course_id", id).then((r) => r.data || []),
  ]);
  openCourse(course, { courts, coaches, children, attendance });
}

async function saveCourse(e) {
  e.preventDefault();
  const err = $("c-error"); err.hidden = true;
  const start = $("c-start").value, end = $("c-end").value;
  if (end <= start) return failC(err, "L'heure de fin doit être après le début.");
  const courts = chipValues("c-courts");
  if (!courts.length) return failC(err, "Sélectionnez au moins un court.");
  const children = chipValues("c-children");
  if (children.length > 30) return failC(err, "30 enfants maximum.");
  const coaches = chipValues("c-coaches");

  const row = {
    course_type_id: $("c-type").value || null,
    title: $("c-label").value.trim() || null,
    course_date: $("c-date").value,
    start_time: start + ":00", end_time: end + ":00",
    color: $("c-color").value, created_by: meId,
  };
  const id = $("c-id").value;
  let courseId = id;
  if (id) {
    const { error } = await sb.from("courses").update(row).eq("id", id);
    if (error) return failC(err, error.message);
    // reset liens + occupations
    await Promise.all([
      sb.from("course_coaches").delete().eq("course_id", id),
      sb.from("course_participants").delete().eq("course_id", id),
      sb.from("court_bookings").delete().eq("course_id", id),
    ]);
  } else {
    const { data, error } = await sb.from("courses").insert(row).select("id").single();
    if (error) return failC(err, error.message);
    courseId = data.id;
  }

  // occupations des courts (bloque la grille)
  const label = row.title || courseTypes.find((t) => t.id === row.course_type_id)?.name || "Cours";
  let conflicts = 0;
  for (const cid of courts) {
    const { error } = await sb.from("court_bookings").insert({
      court_id: Number(cid), booking_date: row.course_date,
      start_time: row.start_time, end_time: row.end_time,
      kind: "cours", title: label, color: row.color, created_by: meId, course_id: courseId,
    });
    if (error) conflicts++;
  }
  if (coaches.length) await sb.from("course_coaches").insert(coaches.map((p) => ({ course_id: courseId, coach_person_id: p })));
  if (children.length) await sb.from("course_participants").insert(children.map((p) => ({ course_id: courseId, child_person_id: p })));

  if (conflicts) alert(`Cours enregistré, mais ${conflicts} court(s) étai(en)t déjà occupé(s) sur ce créneau.`);
  $("course-modal").classList.add("hidden");
  loadCoursesDay();
}

async function deleteCourse() {
  const id = $("c-id").value;
  if (!id || !confirm("Supprimer ce cours (et libérer les courts) ?")) return;
  await sb.from("courses").delete().eq("id", id); // cascade : bookings, coaches, participants, présences
  $("course-modal").classList.add("hidden");
  loadCoursesDay();
}

const mondayOf = (iso) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoA(d); };
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return isoA(d); };

let cwSrcMon = null, cwSrcEnd = null, cwToCreate = null, cwTgtMon = null, cwCoaches = [], cwParts = [], cwConflicts = [];

function copyWeek() { // ouvre le modal
  cwSrcMon = mondayOf($("cs-date").value);
  cwSrcEnd = addDays(cwSrcMon, 6);
  cwToCreate = null;
  $("cw-src").textContent = `Copier tous les cours de la semaine du ${frDate(cwSrcMon)} vers :`;
  $("cw-date").value = addDays(cwSrcMon, 7);
  $("cw-summary").hidden = true; $("cw-summary").innerHTML = "";
  $("cw-error").hidden = true;
  $("cw-go").disabled = false; $("cw-go").textContent = "Vérifier";
  $("copyweek-modal").classList.remove("hidden");
}

async function cwGo() {
  if (cwToCreate) return cwRun();
  const err = $("cw-error"); err.hidden = true;
  const target = $("cw-date").value;
  if (!target) { err.textContent = "Choisis une semaine cible."; err.hidden = false; return; }
  cwTgtMon = mondayOf(target);
  const offset = Math.round((new Date(cwTgtMon) - new Date(cwSrcMon)) / 86400000);
  if (offset === 0) { err.textContent = "C'est la même semaine."; err.hidden = false; return; }
  const { data: courses } = await sb.from("courses").select("*").gte("course_date", cwSrcMon).lte("course_date", cwSrcEnd);
  if (!courses || !courses.length) { err.textContent = "Aucun cours dans cette semaine."; err.hidden = false; return; }
  const ids = courses.map((c) => c.id);
  let books;
  [books, cwCoaches, cwParts] = await Promise.all([
    sb.from("court_bookings").select("course_id,court_id").in("course_id", ids).then((r) => r.data || []),
    sb.from("course_coaches").select("course_id,coach_person_id").in("course_id", ids).then((r) => r.data || []),
    sb.from("course_participants").select("course_id,child_person_id").in("course_id", ids).then((r) => r.data || []),
  ]);
  const toCreate = [], conflicts = [];
  for (const c of courses) {
    const newDate = addDays(c.course_date, offset);
    const courts = books.filter((b) => b.course_id === c.id).map((b) => b.court_id);
    const { data: clash } = await sb.from("court_bookings").select("court_id")
      .eq("booking_date", newDate).in("court_id", courts).lt("start_time", c.end_time).gt("end_time", c.start_time);
    if (clash && clash.length) conflicts.push(`${frDate(newDate)} ${c.start_time.slice(0, 5)} — ${c.title || "cours"}`);
    else toCreate.push({ c, newDate, courts });
  }
  cwConflicts = conflicts;
  $("cw-summary").hidden = false;
  $("cw-summary").innerHTML = `<b>${toCreate.length}</b> cours ${toCreate.length > 1 ? "seront copiés" : "sera copié"} vers la semaine du <b>${frDate(cwTgtMon)}</b>.`
    + (conflicts.length ? `<div class="cw-warn">${conflicts.length} en conflit (ignorés, rien n'est écrasé) :<br>${conflicts.map(esc).join("<br>")}</div>` : "");
  if (!toCreate.length) { $("cw-go").disabled = true; $("cw-go").textContent = "Rien à copier"; return; }
  cwToCreate = toCreate;
  $("cw-go").textContent = `Copier ${toCreate.length} cours`;
}

async function cwRun() {
  $("cw-go").disabled = true; $("cw-go").textContent = "Copie…";
  let created = 0;
  for (const { c, newDate, courts } of cwToCreate) {
    const { data: nc } = await sb.from("courses").insert({
      course_type_id: c.course_type_id, title: c.title, course_date: newDate,
      start_time: c.start_time, end_time: c.end_time, color: c.color, created_by: meId,
    }).select("id").single();
    if (!nc) continue;
    for (const court of courts) await sb.from("court_bookings").insert({
      court_id: court, booking_date: newDate, start_time: c.start_time, end_time: c.end_time,
      kind: "cours", title: c.title || "Cours", color: c.color, created_by: meId, course_id: nc.id,
    });
    const cs = cwCoaches.filter((x) => x.course_id === c.id).map((x) => ({ course_id: nc.id, coach_person_id: x.coach_person_id }));
    if (cs.length) await sb.from("course_coaches").insert(cs);
    const ps = cwParts.filter((x) => x.course_id === c.id).map((x) => ({ course_id: nc.id, child_person_id: x.child_person_id }));
    if (ps.length) await sb.from("course_participants").insert(ps);
    created++;
  }
  $("copyweek-modal").classList.add("hidden");
  cwToCreate = null;
  alert(`✓ ${created} cours copiés.` + (cwConflicts.length ? ` ${cwConflicts.length} ignoré(s) pour conflit.` : ""));
  loadCoursesDay();
}
function failC(el, msg) { el.textContent = msg; el.hidden = false; }

function closePerson() {
  $("people-detail").classList.add("hidden");
  $("people-list-wrap").classList.remove("hidden");
}

async function savePerson(e) {
  e.preventDefault();
  const err = $("person-error");
  err.hidden = true;
  const lines = (id) => $(id).value.split("\n").map((x) => x.trim()).filter(Boolean);
  const row = {
    first_name: $("p-first").value.trim(),
    last_name: $("p-last").value.trim(),
    birthdate: $("p-birth").value || null,
    gender: $("p-gender").value || null,
    email: $("p-email").value.trim() || null,
    phone: $("p-phone").value.trim() || null,
    avs: $("p-avs").value.trim() || null,
    emails: lines("p-emails"),
    phones: lines("p-phones"),
    photo_url: personPhotoUrl,
    address: $("p-address").value.trim() || null,
    postal_code: $("p-postal").value.trim() || null,
    city: $("p-city").value.trim() || null,
    bexio_contact_id: $("p-bexio").value ? Number($("p-bexio").value) : null,
    is_active: $("p-active").checked,
    notes: $("p-notes").value.trim() || null,
  };
  let id = $("p-id").value;
  let error;
  if (id) ({ error } = await sb.from("people").update(row).eq("id", id));
  else {
    const res = await sb.from("people").insert(row).select("id").single();
    error = res.error; id = res.data?.id;
  }
  if (error) { err.textContent = "Enregistrement impossible : " + error.message; err.hidden = false; return; }
  // Rôles : on remplace l'ensemble
  if (id) {
    await sb.from("person_roles").delete().eq("person_id", id);
    const rr = [...personRolesSel].map((role) => ({ person_id: id, role }));
    if (rr.length) await sb.from("person_roles").insert(rr);
  }
  closePerson();
  loadPeople();
}

async function deletePerson() {
  const id = $("p-id").value;
  if (!id || !confirm("Supprimer définitivement cette fiche ?")) return;
  const { error } = await sb.from("people").delete().eq("id", id);
  if (error) { alert("Suppression impossible : " + error.message); return; }
  closePerson();
  loadPeople();
}

async function invitePerson() {
  const id = $("p-id").value;
  const email = $("p-email").value.trim();
  if (!email) { alert("Renseignez un email dans la fiche, enregistrez, puis invitez."); return; }
  if (!confirm(`Envoyer une invitation par email à ${email} ?`)) return;
  const { data, error } = await sb.functions.invoke("invite-member", {
    body: { person_id: id || null, email, redirectTo: location.origin + "/set-password.html" },
  });
  if (error || data?.error) { alert("Échec de l'invitation : " + (data?.error || error?.message)); return; }
  alert("Invitation envoyée à " + email + ".\nLa personne recevra un email pour activer son compte.");
}

// ===================================================================
//  Stages
// ===================================================================
let stgCats = [], stgSessions = [], stgCounts = {}, stgCurrent = null, stgRegs = [], stgSessionCats = {};
const stgActiveCats = () => stgCats.filter((c) => c.active);

const stgDays = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
const stgEffPrice = (price, days) => Math.round(Number(price) * Math.min(days, 5) / 5 * 100) / 100;
const stgCatById = (id) => stgCats.find((c) => c.id === id) || {};

function initStages() {
  document.querySelectorAll("#view-stages .stg-subtab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#view-stages .stg-subtab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("#view-stages .stg-sub").forEach((s) => s.classList.toggle("hidden", s.id !== "stg-sub-" + b.dataset.sub));
      if (b.dataset.sub === "stages" || b.dataset.sub === "categories") loadStagesTab();
      if (b.dataset.sub === "mails") loadStageMails();
      if (b.dataset.sub === "questionnaires") loadSurveyTab("stage");
    }));
  $("stg-cat-new").addEventListener("click", createStageCat);
  $("stg-new").addEventListener("click", () => openStageModal(null));
  $("stg-detail-back").addEventListener("click", closeStageDetail);
  $("stg-detail-edit").addEventListener("click", () => openStageModal(stgCurrent));
  $("stg-program-save").addEventListener("click", saveProgram);
  $("stg-reg-add").addEventListener("click", openRegModal);
  $("stg-survey-new").addEventListener("click", () => createSurvey("stage"));
  $("stg-mail-cat").addEventListener("change", () => renderStageMails($("stg-mail-cat").value));
  // Modal stage
  $("stage-close").addEventListener("click", () => $("stage-modal").classList.add("hidden"));
  $("stage-modal").addEventListener("click", (e) => { if (e.target === $("stage-modal")) $("stage-modal").classList.add("hidden"); });
  $("stage-form").addEventListener("submit", saveStage);
  $("stage-delete").addEventListener("click", deleteStage);
  $("stg-f-photo-btn").addEventListener("click", () => $("stg-f-photo-file").click());
  $("stg-f-photo-file").addEventListener("change", (e) => uploadStageImage(e.target));
  // Modal inscrit
  $("reg-close").addEventListener("click", () => $("reg-modal").classList.add("hidden"));
  $("reg-modal").addEventListener("click", (e) => { if (e.target === $("reg-modal")) $("reg-modal").classList.add("hidden"); });
  $("reg-form").addEventListener("submit", saveReg);
}

async function loadStagesTab() {
  const [{ data: cats }, { data: sessions }, { data: regs }, { data: links }] = await Promise.all([
    sb.from("stage_categories").select("*").order("sort_order"),
    sb.from("stage_sessions").select("*").order("start_date", { ascending: false }),
    sb.from("stage_registrations").select("stage_id"),
    sb.from("stage_session_categories").select("session_id,category_id"),
  ]);
  stgCats = cats || [];
  stgSessions = sessions || [];
  stgCounts = {};
  for (const r of regs || []) stgCounts[r.stage_id] = (stgCounts[r.stage_id] || 0) + 1;
  stgSessionCats = {};
  for (const l of links || []) (stgSessionCats[l.session_id] = stgSessionCats[l.session_id] || []).push(l.category_id);
  renderStageCats();
  renderStageList();
}

// ---- Catégories ----
function renderStageCats() {
  $("stg-cat-list").innerHTML = stgCats.map((c) => `
    <div class="stg-cat-card" data-id="${c.id}">
      <div class="gz-mail-head">
        <input type="text" class="stg-cat-name" value="${esc(c.name)}" style="font-weight:800;flex:1;margin-right:10px"/>
        <label class="gz-mail-en"><input type="checkbox" class="stg-cat-active" ${c.active ? "checked" : ""}/> Active</label>
      </div>
      <label class="gz-mail-lbl">Description</label>
      <textarea class="stg-cat-desc" rows="2" style="width:100%;box-sizing:border-box">${esc(c.description || "")}</textarea>
      <div class="stg-cat-grid">
        <label>Prix (CHF)<input type="number" class="stg-cat-price" value="${c.price}"/></label>
        <label class="stg-inline"><input type="checkbox" class="stg-cat-meal" ${c.meal ? "checked" : ""}/> Repas</label>
        <label class="stg-inline"><input type="checkbox" class="stg-cat-tshirt" ${c.tshirt ? "checked" : ""}/> Offrir un t-shirt</label>
        <label class="stg-inline"><input type="checkbox" class="stg-cat-ranking" ${c.ask_ranking ? "checked" : ""}/> Demander le classement</label>
        <label>Option 3h privé (+CHF)<input type="number" class="stg-cat-addon" style="width:120px" value="${c.private_addon_price ?? ""}" placeholder="—"/></label>
      </div>
      <div class="gz-mail-foot">
        <div class="gz-mail-img">
          ${c.image_url ? `<img src="${c.image_url}" class="gz-mail-thumb"/>` : ""}
          <button type="button" class="ghost stg-cat-imgbtn">${c.image_url ? "Changer la photo" : "Photo d'illustration"}</button>
          <input type="file" accept="image/*" class="stg-cat-file hidden"/>
        </div>
        <div style="display:flex;gap:8px">
          <button type="button" class="primary stg-cat-save">Enregistrer</button>
          <button type="button" class="fam-del stg-cat-del">Supprimer</button>
        </div>
      </div>
    </div>`).join("") || '<p class="muted">Aucune catégorie.</p>';
  $("stg-cat-list").querySelectorAll(".stg-cat-card").forEach((card) => {
    const id = card.dataset.id;
    card.querySelector(".stg-cat-save").addEventListener("click", () => saveStageCat(id, card));
    card.querySelector(".stg-cat-del").addEventListener("click", () => delStageCat(id));
    const file = card.querySelector(".stg-cat-file");
    card.querySelector(".stg-cat-imgbtn").addEventListener("click", () => file.click());
    file.addEventListener("change", () => uploadCatImage(id, file));
  });
}

async function createStageCat() {
  const sort = (stgCats.at(-1)?.sort_order || stgCats.length) + 1;
  const { error } = await sb.from("stage_categories").insert({ name: "Nouvelle catégorie", sort_order: sort });
  if (error) return alert(error.message);
  await loadStagesTab();
  // ouvre l'édition inline de la nouvelle carte
  const last = $("stg-cat-list").querySelector(".stg-cat-card:last-child .stg-cat-name");
  if (last) { last.focus(); last.select(); }
}

async function saveStageCat(id, card) {
  const patch = {
    name: card.querySelector(".stg-cat-name").value.trim(),
    description: card.querySelector(".stg-cat-desc").value.trim() || null,
    price: Number(card.querySelector(".stg-cat-price").value) || 0,
    meal: card.querySelector(".stg-cat-meal").checked,
    tshirt: card.querySelector(".stg-cat-tshirt").checked,
    ask_ranking: card.querySelector(".stg-cat-ranking").checked,
    private_addon_price: card.querySelector(".stg-cat-addon").value ? Number(card.querySelector(".stg-cat-addon").value) : null,
    active: card.querySelector(".stg-cat-active").checked,
  };
  const btn = card.querySelector(".stg-cat-save");
  btn.textContent = "…";
  const { error } = await sb.from("stage_categories").update(patch).eq("id", id);
  btn.textContent = error ? "Erreur" : "Enregistré ✓";
  if (!error) Object.assign(stgCatById(id), patch);
  setTimeout(() => (btn.textContent = "Enregistrer"), 1500);
}

async function delStageCat(id) {
  if (!confirm("Supprimer cette catégorie ? (impossible si des stages l'utilisent)")) return;
  const { error } = await sb.from("stage_categories").delete().eq("id", id);
  if (error) return alert("Suppression impossible : " + error.message);
  loadStagesTab();
}

async function uploadCatImage(id, file) {
  if (!file.files || !file.files[0]) return;
  const f = file.files[0];
  const path = `stages/cat-${id}-${Date.now()}`;
  const { error } = await sb.storage.from("gz-photos").upload(path, f, { upsert: true, contentType: f.type });
  if (error) { alert("Photo : " + error.message); return; }
  const url = sb.storage.from("gz-photos").getPublicUrl(path).data.publicUrl;
  await sb.from("stage_categories").update({ image_url: url }).eq("id", id);
  stgCatById(id).image_url = url;
  renderStageCats();
}

// ---- Liste des stages ----
function stgVisLabel(s) {
  if (s.visibility_mode === "manual") return s.visible ? "Visible (manuel)" : "Masqué (manuel)";
  const today = new Date().toISOString().slice(0, 10);
  const limit = new Date(new Date(s.start_date) - 3 * 86400000).toISOString().slice(0, 10);
  return today <= limit ? "Visible (auto)" : "Masqué (auto, J-3)";
}

function stgCatBadges(sessionId) {
  const ids = stgSessionCats[sessionId] || [];
  if (!ids.length) return '<span class="muted">— aucune —</span>';
  return ids.map((id) => `<span class="role-badge">${esc(stgCatById(id).name || "?")}</span>`).join(" ");
}

function renderStageList() {
  $("stg-rows").innerHTML = stgSessions.map((s) => {
    const days = stgDays(s.start_date, s.end_date);
    const dates = s.start_date === s.end_date ? frDate(s.start_date) : `${frDate(s.start_date)} → ${frDate(s.end_date)}`;
    return `<tr class="stg-row" data-id="${s.id}">
      <td><b>${esc(s.title || "Stage")}</b></td>
      <td>${dates}</td>
      <td>${jours(days)}${days < 5 ? " <span class='muted'>(pro-rata)</span>" : ""}</td>
      <td class="role-cell">${stgCatBadges(s.id)}</td>
      <td>${stgCounts[s.id] || 0}</td>
      <td>
        <select class="stg-vis" data-id="${s.id}">
          <option value="auto"${s.visibility_mode === "auto" ? " selected" : ""}>Auto (J-3)</option>
          <option value="show"${s.visibility_mode === "manual" && s.visible ? " selected" : ""}>Visible</option>
          <option value="hide"${s.visibility_mode === "manual" && !s.visible ? " selected" : ""}>Masqué</option>
        </select>
        <div class="muted" style="font-size:.72rem">${stgVisLabel(s)}</div>
      </td>
    </tr>`;
  }).join("") || '<tr><td colspan="6" class="muted">Aucun stage.</td></tr>';
  $("stg-rows").querySelectorAll(".stg-row").forEach((tr) =>
    tr.addEventListener("click", (e) => { if (e.target.closest(".stg-vis")) return; openStage(tr.dataset.id); }));
  $("stg-rows").querySelectorAll(".stg-vis").forEach((sel) =>
    sel.addEventListener("change", () => setStageVisibility(sel.dataset.id, sel.value)));
}

async function setStageVisibility(id, val) {
  const patch = val === "auto" ? { visibility_mode: "auto" }
    : { visibility_mode: "manual", visible: val === "show" };
  await sb.from("stage_sessions").update(patch).eq("id", id);
  Object.assign(stgSessions.find((s) => s.id === id), patch);
  renderStageList();
}

// ---- Modal création / édition d'un stage (semaine) ----
let stageImageUrl = null;
function renderStageImage() {
  const box = $("stg-f-photo-preview");
  box.innerHTML = stageImageUrl ? `<img src="${stageImageUrl}" alt="" />` : "";
  box.classList.toggle("empty", !stageImageUrl);
}
async function uploadStageImage(input) {
  if (!input.files || !input.files[0]) return;
  const f = input.files[0];
  $("stg-f-photo-status").textContent = "Envoi…";
  const path = `stages/session-${Date.now()}`;
  const up = await sb.storage.from("gz-photos").upload(path, f, { upsert: true, contentType: f.type });
  if (up.error) { $("stg-f-photo-status").textContent = "Erreur : " + up.error.message; return; }
  stageImageUrl = sb.storage.from("gz-photos").getPublicUrl(path).data.publicUrl;
  input.value = "";
  $("stg-f-photo-status").textContent = "";
  renderStageImage();
}
function openStageModal(id) {
  if (!stgActiveCats().length) return alert("Crée d'abord au moins une catégorie active (onglet Catégories).");
  $("stage-error").hidden = true;
  const s = id ? stgSessions.find((x) => x.id === id) : null;
  $("stg-f-id").value = id || "";
  $("stage-modal-title").textContent = s ? "Modifier le stage" : "Nouveau stage";
  $("stg-f-name").value = s?.title || "";
  $("stg-f-start").value = s?.start_date || "";
  $("stg-f-end").value = s?.end_date || "";
  stageImageUrl = s?.image_url || null;
  $("stg-f-photo-status").textContent = "";
  renderStageImage();
  $("stage-delete").classList.toggle("hidden", !s);
  const selected = new Set(id ? (stgSessionCats[id] || []) : []);
  $("stg-f-cats").innerHTML = stgActiveCats().map((c) =>
    `<label class="stg-cat-opt"><input type="checkbox" value="${c.id}"${selected.has(c.id) ? " checked" : ""}/>
      <span><b>${esc(c.name)}</b> <span class="muted">${c.price} CHF${c.meal ? " · repas" : ""}${c.tshirt ? " · t-shirt" : ""}</span></span></label>`).join("");
  $("stage-modal").classList.remove("hidden");
}

async function saveStage(e) {
  e.preventDefault();
  const err = $("stage-error"); err.hidden = true;
  const id = $("stg-f-id").value;
  const name = $("stg-f-name").value.trim();
  const start = $("stg-f-start").value, end = $("stg-f-end").value;
  if (!name || !start || !end) { err.textContent = "Nom et dates obligatoires."; err.hidden = false; return; }
  if (end < start) { err.textContent = "La date de fin précède le début."; err.hidden = false; return; }
  const catIds = [...$("stg-f-cats").querySelectorAll("input:checked")].map((c) => c.value);
  if (!catIds.length) { err.textContent = "Coche au moins une catégorie ouverte à l'inscription."; err.hidden = false; return; }
  let sid = id;
  const patch = { title: name, start_date: start, end_date: end, image_url: stageImageUrl };
  if (id) { const { error } = await sb.from("stage_sessions").update(patch).eq("id", id); if (error) { err.textContent = error.message; err.hidden = false; return; } }
  else {
    const res = await sb.from("stage_sessions").insert({ ...patch, visibility_mode: "auto" }).select("id").single();
    if (res.error) { err.textContent = res.error.message; err.hidden = false; return; }
    sid = res.data.id;
  }
  // remplace les catégories ouvertes
  await sb.from("stage_session_categories").delete().eq("session_id", sid);
  await sb.from("stage_session_categories").insert(catIds.map((cid) => ({ session_id: sid, category_id: cid })));
  $("stage-modal").classList.add("hidden");
  await loadStagesTab();
  if (id && stgCurrent === id) openStage(id); // rafraîchit le détail ouvert
}

async function deleteStage() {
  const id = $("stg-f-id").value;
  if (!id || !confirm("Supprimer ce stage et tous ses inscrits ?")) return;
  await sb.from("stage_registrations").delete().eq("stage_id", id);
  await sb.from("stage_session_categories").delete().eq("session_id", id);
  const { error } = await sb.from("stage_sessions").delete().eq("id", id);
  if (error) return alert(error.message);
  $("stage-modal").classList.add("hidden");
  closeStageDetail();
  loadStagesTab();
}

// ---- Détail d'un stage : inscrits + programme ----
async function openStage(id) {
  stgCurrent = id;
  const s = stgSessions.find((x) => x.id === id);
  const days = stgDays(s.start_date, s.end_date);
  const catList = (stgSessionCats[id] || []).map((cid) => {
    const c = stgCatById(cid);
    return `${esc(c.name || "?")} <span class="muted">(${stgEffPrice(c.price || 0, days)} CHF)</span>`;
  });
  $("stg-detail-title").textContent = (s.title || "Stage");
  $("stg-detail-meta").innerHTML = `${frDate(s.start_date)}${s.end_date !== s.start_date ? " → " + frDate(s.end_date) : ""} · ${jours(days)}${days < 5 ? " (pro-rata)" : ""}<br>`
    + `Catégories : ${catList.length ? catList.join(" · ") : '<span class="muted">aucune</span>'}`;
  $("stg-program").value = s.program || "";
  $("stg-list-wrap").classList.add("hidden");
  $("stg-detail").classList.remove("hidden");
  await loadRegistrations();
}

function closeStageDetail() {
  stgCurrent = null;
  $("stg-detail").classList.add("hidden");
  $("stg-list-wrap").classList.remove("hidden");
}

async function saveProgram() {
  const btn = $("stg-program-save");
  btn.textContent = "…";
  const { error } = await sb.from("stage_sessions").update({ program: $("stg-program").value }).eq("id", stgCurrent);
  const s = stgSessions.find((x) => x.id === stgCurrent); if (s && !error) s.program = $("stg-program").value;
  btn.textContent = error ? "Erreur" : "Enregistré ✓";
  setTimeout(() => (btn.textContent = "Enregistrer le programme"), 1500);
}

async function loadRegistrations() {
  const { data } = await sb.from("stage_registrations").select("*").eq("stage_id", stgCurrent).order("created_at");
  stgRegs = data || [];
  renderRegistrants();
}

function stgRegPrice(r, days) {
  const cat = stgCatById(r.category_id);
  const base = stgEffPrice(cat.price || 0, days);
  const discounted = base * (1 - (r.discount_pct || 0) / 100);
  const addon = r.private_addon ? Number(cat.private_addon_price || 0) : 0;
  return Math.round((discounted + addon) * 100) / 100;
}

function renderRegistrants() {
  const s = stgSessions.find((x) => x.id === stgCurrent);
  const days = stgDays(s.start_date, s.end_date);
  const openCats = (stgSessionCats[stgCurrent] || []).map((id) => stgCatById(id)).filter((c) => c.id);
  $("stg-reg-count").textContent = stgRegs.length;
  $("stg-reg-rows").innerHTML = stgRegs.map((r) => {
    const cat = stgCatById(r.category_id);
    const price = stgRegPrice(r, days);
    const catSel = `<select class="stg-reg-cat" data-id="${r.id}">
      ${openCats.map((c) => `<option value="${c.id}"${c.id === r.category_id ? " selected" : ""}>${esc(c.name)}</option>`).join("")}
      ${cat.id && !openCats.some((c) => c.id === cat.id) ? `<option value="${cat.id}" selected>${esc(cat.name)} (fermée)</option>` : ""}
    </select>`;
    const rebate = r.discount_pct ? `−${r.discount_pct}% <span class="muted">(${esc(r.discount_reason || "")})</span> <button class="fam-del stg-reb-del" data-id="${r.id}">✕</button>`
      : `<button class="ghost stg-reb-add" data-id="${r.id}">−20%</button>`;
    const invoice = r.invoice_created
      ? `<span class="muted">Facturé${r.invoice_sent_at ? " le " + frDate(r.invoice_sent_at) : ""}</span>`
      : `<button class="ghost stg-inv" data-id="${r.id}">Créer facture + mail</button>`;
    return `<tr data-id="${r.id}">
      <td><b>${esc(r.first_name)} ${esc(r.last_name)}</b></td>
      <td>${r.birth_date ? frDate(r.birth_date) : "—"}</td>
      <td>${catSel}</td>
      <td>${esc(r.email || "—")}</td>
      <td>${cat.tshirt ? esc(r.tshirt_size || "—") : "—"}</td>
      <td>${cat.meal ? esc(r.meal_restriction || "—") : "—"}</td>
      <td class="stg-cmt">${r.private_addon ? `<span class="stg-tag">+3h privé</span> ` : ""}${r.ranking ? `<b>Classement : ${esc(r.ranking)}</b>${r.comment ? "<br>" : ""}` : ""}${esc(r.comment || "")}</td>
      <td>${rebate}</td>
      <td><b>${price}</b></td>
      <td>${invoice}</td>
      <td><input type="checkbox" class="stg-paid" data-id="${r.id}" ${r.paid ? "checked" : ""}/></td>
      <td><button class="fam-del stg-reg-del" data-id="${r.id}">✕</button></td>
    </tr>`;
  }).join("") || '<tr><td colspan="12" class="muted">Aucun inscrit.</td></tr>';
  const T = $("stg-reg-rows");
  T.querySelectorAll(".stg-reg-cat").forEach((sel) => sel.addEventListener("change", () => changeRegCat(sel.dataset.id, sel.value)));
  T.querySelectorAll(".stg-reb-add").forEach((b) => b.addEventListener("click", () => setDiscount(b.dataset.id)));
  T.querySelectorAll(".stg-reb-del").forEach((b) => b.addEventListener("click", () => removeDiscount(b.dataset.id)));
  T.querySelectorAll(".stg-inv").forEach((b) => b.addEventListener("click", () => createInvoice(b.dataset.id)));
  T.querySelectorAll(".stg-paid").forEach((c) => c.addEventListener("change", () => togglePaid(c.dataset.id, c.checked)));
  T.querySelectorAll(".stg-reg-del").forEach((b) => b.addEventListener("click", () => delRegistrant(b.dataset.id)));
}

async function changeRegCat(id, catId) {
  await sb.from("stage_registrations").update({ category_id: catId }).eq("id", id);
  const r = stgRegs.find((x) => x.id === id); if (r) r.category_id = catId;
  renderRegistrants();
}

// ---- Modal ajout d'un inscrit ----
function openRegModal() {
  const openCats = (stgSessionCats[stgCurrent] || []).map((id) => stgCatById(id)).filter((c) => c.id);
  if (!openCats.length) return alert("Ce stage n'a aucune catégorie ouverte. Ajoute-en via « Modifier le stage ».");
  $("reg-error").hidden = true;
  $("reg-f-first").value = ""; $("reg-f-last").value = ""; $("reg-f-email").value = ""; $("reg-f-birth").value = "";
  $("reg-f-cat").innerHTML = openCats.map((c) => `<option value="${c.id}">${esc(c.name)} — ${c.price} CHF</option>`).join("");
  $("reg-modal").classList.remove("hidden");
}

async function saveReg(e) {
  e.preventDefault();
  const err = $("reg-error"); err.hidden = true;
  const first = $("reg-f-first").value.trim(), last = $("reg-f-last").value.trim();
  if (!first || !last) { err.textContent = "Prénom et nom obligatoires."; err.hidden = false; return; }
  const { error } = await sb.from("stage_registrations").insert({
    stage_id: stgCurrent, first_name: first, last_name: last,
    email: $("reg-f-email").value.trim() || null,
    birth_date: $("reg-f-birth").value || null,
    category_id: $("reg-f-cat").value || null,
  });
  if (error) { err.textContent = error.message; err.hidden = false; return; }
  stgCounts[stgCurrent] = (stgCounts[stgCurrent] || 0) + 1;
  $("reg-modal").classList.add("hidden");
  loadRegistrations();
}

async function setDiscount(id) {
  const t = (prompt("Motif du rabais −20% — tape : famille / 2e semaine", "famille") || "").toLowerCase().trim();
  if (!t) return;
  const reason = t.startsWith("2") || t.includes("sem") ? "2e semaine" : "famille";
  await sb.from("stage_registrations").update({ discount_pct: 20, discount_reason: reason }).eq("id", id);
  const r = stgRegs.find((x) => x.id === id); Object.assign(r, { discount_pct: 20, discount_reason: reason });
  renderRegistrants();
}

async function removeDiscount(id) {
  await sb.from("stage_registrations").update({ discount_pct: 0, discount_reason: null }).eq("id", id);
  const r = stgRegs.find((x) => x.id === id); Object.assign(r, { discount_pct: 0, discount_reason: null });
  renderRegistrants();
}

async function createInvoice(id) {
  if (!confirm("Créer la facture et envoyer le mail d'inscription (avec facture jointe) ?\nL'envoi réel s'activera en production.")) return;
  const now = new Date().toISOString();
  await sb.from("stage_registrations").update({ invoice_created: true, invoice_sent_at: now }).eq("id", id);
  const r = stgRegs.find((x) => x.id === id); Object.assign(r, { invoice_created: true, invoice_sent_at: now });
  renderRegistrants();
}

async function togglePaid(id, paid) {
  await sb.from("stage_registrations").update({ paid, paid_at: paid ? new Date().toISOString() : null }).eq("id", id);
  const r = stgRegs.find((x) => x.id === id); r.paid = paid;
}

async function delRegistrant(id) {
  if (!confirm("Supprimer cet inscrit ?")) return;
  await sb.from("stage_registrations").delete().eq("id", id);
  stgCounts[stgCurrent] = Math.max(0, (stgCounts[stgCurrent] || 1) - 1);
  loadRegistrations();
}

// ---- Mails des stages ----
const STG_MAIL_TYPES = [
  ["inscription", "Confirmation d'inscription (+ facture)", "À l'émission de la facture", false],
  ["rappel_paiement", "Rappel de paiement", "jours avant le début, si non payé", true],
  ["avant_stage", "Avant le stage", "jours avant le début", true],
  ["remerciement", "Remerciement + questionnaire", "jours après la fin", true],
];
let stgMails = [], stgMailSurveys = [];

async function loadStageMails() {
  const [{ data: cats }, { data: tpls }, { data: surveys }] = await Promise.all([
    sb.from("stage_categories").select("id,name").order("sort_order"),
    sb.from("stage_email_templates").select("*"),
    sb.from("gz_surveys").select("id,title,tag"),
  ]);
  stgMails = tpls || [];
  stgMailSurveys = (surveys || []).filter((s) => s.tag === "stage");
  const sel = $("stg-mail-cat");
  const prev = sel.value;
  sel.innerHTML = (cats || []).map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  sel.value = prev && [...sel.options].some((o) => o.value === prev) ? prev : (cats?.[0]?.id || "");
  renderStageMails(sel.value);
}

function renderStageMails(catId) {
  if (!catId) { $("stg-mail-list").innerHTML = '<p class="muted">Crée d\'abord une catégorie.</p>'; return; }
  const byType = {};
  for (const m of stgMails) if (m.category_id === catId) byType[m.type] = m;
  $("stg-mail-list").innerHTML = STG_MAIL_TYPES.map(([type, label, when, hasOffset]) => {
    const m = byType[type] || { category_id: catId, type, subject: "", body: "", offset_days: 0, enabled: true };
    const surveyOpts = type === "remerciement"
      ? `<label class="gz-mail-lbl">Questionnaire lié</label>
         <select class="stg-mail-survey"><option value="">— aucun —</option>${stgMailSurveys.map((s) => `<option value="${s.id}"${m.survey_id === s.id ? " selected" : ""}>${esc(s.title)}</option>`).join("")}</select>`
      : "";
    const offset = hasOffset
      ? `<label class="gz-mail-lbl">Délai</label><div class="stg-inline"><input type="number" class="stg-mail-offset" value="${m.offset_days}" style="width:80px"/> <span class="muted">${when}</span></div>`
      : `<div class="muted" style="font-size:.82rem;margin-top:.4rem">⏱ ${when}</div>`;
    return `<div class="gz-mail-card stg-mail-card" data-type="${type}">
      <div class="gz-mail-head"><b>${label}</b>
        <label class="gz-mail-en"><input type="checkbox" class="stg-mail-enabled" ${m.enabled ? "checked" : ""}/> Actif</label>
      </div>
      ${offset}
      <label class="gz-mail-lbl">Objet</label>
      <input type="text" class="stg-mail-subject" value="${esc(m.subject || "")}"/>
      <label class="gz-mail-lbl">Message</label>
      <textarea class="stg-mail-body" rows="7">${esc(m.body || "")}</textarea>
      ${surveyOpts}
      <div class="gz-mail-foot">
        <div class="gz-mail-img">
          ${m.attachment_url ? `<a href="${m.attachment_url}" target="_blank" rel="noopener" class="muted">Pièce jointe</a>` : ""}
          <button type="button" class="ghost stg-mail-attbtn">${m.attachment_url ? "Changer la pièce jointe" : "Joindre un PDF / image"}</button>
          <input type="file" accept="application/pdf,image/*" class="stg-mail-file hidden"/>
        </div>
        <button type="button" class="primary stg-mail-save">Enregistrer</button>
      </div>
    </div>`;
  }).join("");
  $("stg-mail-list").querySelectorAll(".stg-mail-card").forEach((card) => {
    const type = card.dataset.type;
    card.querySelector(".stg-mail-save").addEventListener("click", () => saveStageMail(catId, type, card));
    const file = card.querySelector(".stg-mail-file");
    card.querySelector(".stg-mail-attbtn").addEventListener("click", () => file.click());
    file.addEventListener("change", () => uploadStageMailAttach(catId, type, file));
  });
}

function stgMailPatch(catId, type, card) {
  const patch = {
    category_id: catId, type,
    subject: card.querySelector(".stg-mail-subject").value.trim(),
    body: card.querySelector(".stg-mail-body").value,
    enabled: card.querySelector(".stg-mail-enabled").checked,
    updated_at: new Date().toISOString(),
  };
  const off = card.querySelector(".stg-mail-offset");
  if (off) patch.offset_days = Number(off.value) || 0;
  const sv = card.querySelector(".stg-mail-survey");
  if (sv) patch.survey_id = sv.value || null;
  return patch;
}

async function saveStageMail(catId, type, card) {
  const patch = stgMailPatch(catId, type, card);
  const btn = card.querySelector(".stg-mail-save");
  btn.textContent = "…";
  const { error } = await sb.from("stage_email_templates").upsert(patch, { onConflict: "category_id,type" });
  btn.textContent = error ? "Erreur" : "Enregistré ✓";
  if (!error) await loadStageMails();
  setTimeout(() => (btn.textContent = "Enregistrer"), 1500);
}

async function uploadStageMailAttach(catId, type, file) {
  if (!file.files || !file.files[0]) return;
  const f = file.files[0];
  const path = `stages/mail-${catId}-${type}-${Date.now()}`;
  const { error } = await sb.storage.from("gz-photos").upload(path, f, { upsert: true, contentType: f.type });
  if (error) { alert("Pièce jointe : " + error.message); return; }
  const url = sb.storage.from("gz-photos").getPublicUrl(path).data.publicUrl;
  await sb.from("stage_email_templates").upsert({ category_id: catId, type, attachment_url: url }, { onConflict: "category_id,type" });
  await loadStageMails();
}

// ===================================================================
//  Tests physiques
// ===================================================================
const PHYS_YOUTH_ROLES = ["sport-etudes", "pro", "competition", "performance", "pro-u18"];
let physTests = [];

function initPhys() {
  document.querySelectorAll("#view-phystests .phys-subtab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#view-phystests .phys-subtab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("#view-phystests .phys-sub").forEach((s) => s.classList.toggle("hidden", s.id !== "phys-sub-" + b.dataset.sub));
      if (b.dataset.sub === "results") loadPhysResults();
      if (b.dataset.sub === "templates") loadPhysTemplates();
    }));
  $("phys-fill-new").addEventListener("click", openPhysFill);
  $("phys-tpl-new").addEventListener("click", createPhysTemplate);
  $("phys-fill-close").addEventListener("click", () => $("phys-fill-modal").classList.add("hidden"));
  $("phys-fill-modal").addEventListener("click", (e) => { if (e.target === $("phys-fill-modal")) $("phys-fill-modal").classList.add("hidden"); });
  $("phys-fill-form").addEventListener("submit", savePhysFill);
  $("pf-test").addEventListener("change", renderPhysFillQuestions);
  $("phys-result-close").addEventListener("click", () => $("phys-result-modal").classList.add("hidden"));
  $("phys-result-modal").addEventListener("click", (e) => { if (e.target === $("phys-result-modal")) $("phys-result-modal").classList.add("hidden"); });
  $("pr-del").addEventListener("click", () => deletePhysResult($("pr-del").dataset.id));
}

async function loadPhysResults() {
  const { data, error } = await sb.from("phys_results").select("*").order("filled_at", { ascending: false });
  const rows = error ? [] : (data || []);
  $("phys-results-rows").innerHTML = rows.length ? rows.map((r) => `
    <tr class="phys-res-row" data-id="${r.id}">
      <td><b>${esc(personName(r.person_id))}</b></td>
      <td>${esc(r.test_name || "—")}</td>
      <td>${esc(r.coach_name || "—")}</td>
      <td>${frDateTime(r.filled_at)}</td>
    </tr>`).join("") : '<tr><td colspan="4" class="muted">Aucun test rempli.</td></tr>';
  $("phys-results-rows").querySelectorAll(".phys-res-row").forEach((tr) =>
    tr.addEventListener("click", () => openPhysResult(tr.dataset.id)));
}

async function openPhysResult(id) {
  const r = (await sb.from("phys_results").select("*").eq("id", id).single()).data;
  if (!r) return;
  const answers = (await sb.from("phys_answers").select("*").eq("result_id", id).order("sort_order")).data || [];
  $("pr-title").textContent = r.test_name || "Test";
  $("pr-meta").innerHTML = `${esc(personName(r.person_id))} · rempli par <b>${esc(r.coach_name || "—")}</b> · ${frDateTime(r.filled_at)}`;
  $("pr-answers").innerHTML = answers.length ? answers.map((a) => {
    const v = a.answer_type === "number" ? (a.value_num ?? "—") : (a.value_text || "—");
    return `<div class="phys-ans"><span class="phys-ans-q">${esc(a.label || "")}</span><span class="phys-ans-v">${esc(v)}</span></div>`;
  }).join("") : '<p class="muted">Aucune réponse.</p>';
  $("pr-del").dataset.id = id;
  $("phys-result-modal").classList.remove("hidden");
}

async function deletePhysResult(id) {
  if (!id || !confirm("Supprimer ce test rempli ?")) return;
  const { error } = await sb.from("phys_results").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  $("phys-result-modal").classList.add("hidden");
  loadPhysResults();
}

async function loadPhysTemplates() {
  const [{ data: tests }, { data: qs }] = await Promise.all([
    sb.from("phys_tests").select("*").order("sort_order").order("created_at"),
    sb.from("phys_test_questions").select("*").order("sort_order"),
  ]);
  physTests = tests || [];
  const qByTest = {};
  for (const q of qs || []) (qByTest[q.test_id] = qByTest[q.test_id] || []).push(q);
  $("phys-tpl-list").innerHTML = physTests.length ? physTests.map((t) => `
    <div class="phys-tpl-card" data-id="${t.id}">
      <div class="phys-tpl-head">
        <input type="text" class="phys-tpl-name" value="${esc(t.name)}" placeholder="Nom du test" />
        <label class="stg-inline"><input type="checkbox" class="phys-tpl-active" ${t.active ? "checked" : ""}/> Actif</label>
      </div>
      <div class="phys-q-rows">${(qByTest[t.id] || []).map((q) => physQRow(q.label, q.answer_type)).join("")}</div>
      <button type="button" class="ghost phys-q-add">+ Question</button>
      <div class="phys-tpl-foot">
        <button type="button" class="primary phys-tpl-save">Enregistrer</button>
        <button type="button" class="fam-del phys-tpl-del">Supprimer</button>
      </div>
    </div>`).join("") : '<p class="muted">Aucun test. Cliquez « + Nouveau test ».</p>';
  $("phys-tpl-list").querySelectorAll(".phys-tpl-card").forEach((card) => {
    const id = card.dataset.id;
    card.querySelector(".phys-q-add").addEventListener("click", () => {
      card.querySelector(".phys-q-rows").insertAdjacentHTML("beforeend", physQRow("", "text"));
      wirePhysQRows(card);
    });
    card.querySelector(".phys-tpl-save").addEventListener("click", () => savePhysTemplate(id, card));
    card.querySelector(".phys-tpl-del").addEventListener("click", () => deletePhysTemplate(id));
    wirePhysQRows(card);
  });
}

function physQRow(label, type) {
  return `<div class="phys-q-row">
    <input type="text" class="phys-q-label" value="${esc(label)}" placeholder="Question (ex. Sprint 20 m)" />
    <select class="phys-q-type">
      <option value="text"${type === "text" ? " selected" : ""}>Texte</option>
      <option value="number"${type === "number" ? " selected" : ""}>Numérique</option>
    </select>
    <button type="button" class="fam-del phys-q-del">✕</button>
  </div>`;
}
function wirePhysQRows(card) {
  card.querySelectorAll(".phys-q-del").forEach((b) => { b.onclick = () => b.closest(".phys-q-row").remove(); });
}

async function createPhysTemplate() {
  const sort = (physTests.at(-1)?.sort_order || physTests.length) + 1;
  const { error } = await sb.from("phys_tests").insert({ name: "Nouveau test", sort_order: sort });
  if (error) { alert(error.message); return; }
  await loadPhysTemplates();
  const last = $("phys-tpl-list").querySelector(".phys-tpl-card:last-child .phys-tpl-name");
  if (last) { last.focus(); last.select(); }
}

async function savePhysTemplate(id, card) {
  const name = card.querySelector(".phys-tpl-name").value.trim() || "Test";
  const active = card.querySelector(".phys-tpl-active").checked;
  const questions = [...card.querySelectorAll(".phys-q-row")].map((row, i) => ({
    test_id: id,
    label: row.querySelector(".phys-q-label").value.trim(),
    answer_type: row.querySelector(".phys-q-type").value,
    sort_order: i,
  })).filter((q) => q.label);
  const btn = card.querySelector(".phys-tpl-save");
  btn.textContent = "…";
  await sb.from("phys_tests").update({ name, active }).eq("id", id);
  await sb.from("phys_test_questions").delete().eq("test_id", id);
  if (questions.length) await sb.from("phys_test_questions").insert(questions);
  btn.textContent = "Enregistré ✓";
  setTimeout(() => (btn.textContent = "Enregistrer"), 1500);
}

async function deletePhysTemplate(id) {
  if (!confirm("Supprimer ce modèle de test ? (les tests déjà remplis sont conservés)")) return;
  const { error } = await sb.from("phys_tests").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  loadPhysTemplates();
}

async function openPhysFill() {
  $("pf-error").hidden = true;
  const youths = people.filter((p) => hasRoleIn(p.id, PHYS_YOUTH_ROLES))
    .sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));
  $("pf-person").innerHTML = '<option value="">— Choisir un jeune —</option>'
    + youths.map((p) => `<option value="${p.id}">${esc(p.last_name)} ${esc(p.first_name)}</option>`).join("");
  const { data: tests } = await sb.from("phys_tests").select("*").eq("active", true).order("sort_order").order("created_at");
  physTests = tests || [];
  $("pf-test").innerHTML = '<option value="">— Choisir un test —</option>'
    + physTests.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
  $("pf-questions").innerHTML = "";
  $("phys-fill-modal").classList.remove("hidden");
}

async function renderPhysFillQuestions() {
  const tid = $("pf-test").value;
  if (!tid) { $("pf-questions").innerHTML = ""; return; }
  const qs = (await sb.from("phys_test_questions").select("*").eq("test_id", tid).order("sort_order")).data || [];
  $("pf-questions").innerHTML = qs.length ? qs.map((q) => `
    <label class="pf-q">${esc(q.label)}${q.answer_type === "number" ? ' <span class="muted">(nombre)</span>' : ""}
      <input class="pf-a" data-qid="${q.id}" data-type="${q.answer_type}" data-label="${esc(q.label)}"
        type="${q.answer_type === "number" ? "number" : "text"}" step="any" />
    </label>`).join("") : '<p class="muted" style="font-size:.85rem">Ce test n\'a pas encore de questions.</p>';
}

async function savePhysFill(e) {
  e.preventDefault();
  const err = $("pf-error"); err.hidden = true;
  const pid = $("pf-person").value, tid = $("pf-test").value;
  if (!pid || !tid) { err.textContent = "Choisis un jeune et un test."; err.hidden = false; return; }
  const testName = $("pf-test").options[$("pf-test").selectedIndex]?.textContent || "Test";
  const res = await sb.from("phys_results").insert({
    test_id: tid, test_name: testName, person_id: pid,
    coach_person_id: myPersonId, coach_name: meName, created_by: meId,
  }).select("id").single();
  if (res.error) { err.textContent = res.error.message; err.hidden = false; return; }
  const answers = [...$("pf-questions").querySelectorAll(".pf-a")].map((inp, i) => {
    const num = inp.dataset.type === "number";
    return {
      result_id: res.data.id, question_id: inp.dataset.qid, label: inp.dataset.label,
      answer_type: inp.dataset.type,
      value_text: num ? null : (inp.value.trim() || null),
      value_num: num ? (inp.value === "" ? null : Number(inp.value)) : null,
      sort_order: i,
    };
  });
  if (answers.length) await sb.from("phys_answers").insert(answers);
  $("phys-fill-modal").classList.add("hidden");
  loadPhysResults();
}

