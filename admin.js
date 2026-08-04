// Console admin — CRM membres (accès staff uniquement).
import { sb, requireLogin, myRoles, hasAny, STAFF_ROLES } from "./common.js";

const $ = (id) => document.getElementById(id);
// Petite coupe SVG (remplace l'emoji 🏆 dans les tableaux)
const ICO_CUP = '<svg viewBox="0 0 24 24" width="13" height="13" style="vertical-align:-1px" fill="none" stroke="#c8901f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v4.5a4 4 0 0 1-8 0V4z"/><path d="M8 5.5H5V7a3 3 0 0 0 3 3M16 5.5h3V7a3 3 0 0 1-3 3"/><path d="M10 13.5V16h4v-2.5M8 20h8M12 16v4"/></svg>';
let people = [];
let meId = null;
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
    init(roles);
  }
}

// Accès aux onglets par rôle (défense en profondeur : la RLS protège déjà
// les écritures en base ; ceci masque l'UI selon le rôle).
const DEFAULT_TAB_ACCESS = {
  superadmin: ["membres", "roles", "resa", "cours", "gamezone", "caisse", "stages", "stats"],
  admin:      ["membres", "roles", "resa", "cours", "gamezone", "caisse", "stages", "stats"],
  secretaire: ["membres", "resa", "caisse", "stages", "stats"],
  head_coach: ["resa", "cours", "stages"],
  coach:      ["resa", "cours"],
  organisateur: ["gamezone"],
  responsable:  ["gamezone"],
};
const ADMIN_TABS = [["membres", "Membres"], ["roles", "Rôles & accès"], ["resa", "Réservations"], ["cours", "Cours"], ["gamezone", "GameZone"], ["caisse", "Caisse"], ["stages", "Stages"], ["stats", "Statistiques"]];
const ROLE_LIST = [["superadmin", "Superadmin"], ["admin", "Admin"], ["secretaire", "Secrétaire"], ["head_coach", "Head coach"], ["coach", "Coach"], ["organisateur", "Official"], ["responsable", "Responsable"]];
const ASSIGNABLE_ROLES = ["superadmin", "admin", "secretaire", "head_coach", "coach", "membre", "organisateur", "responsable"];

const tabAccessMap = () => settings.tab_access || DEFAULT_TAB_ACCESS;

function applyTabAccess(roles) {
  const access = tabAccessMap();
  let first = null;
  document.querySelectorAll(".side-item[data-view]").forEach((b) => {
    const v = b.dataset.view;
    if (v === "bientot") return;
    const allowed = roles.some((r) => (access[r] || []).includes(v));
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
  $("close-person").addEventListener("click", closePerson);
  $("person-modal").addEventListener("click", (e) => { if (e.target === $("person-modal")) closePerson(); });
  $("person-form").addEventListener("submit", savePerson);
  $("delete-person").addEventListener("click", deletePerson);
  $("invite-person").addEventListener("click", invitePerson);
  $("fam-add-btn").addEventListener("click", addFamily);
  $("cr-add-btn").addEventListener("click", rechargeCredit);
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
  $("resa-season").textContent = season === "ete" ? "Été" : "Hiver";
  const col = season === "ete" ? "open_summer" : "open_winter";
  resaCourts = resaCourtsAll.filter((c) => c[col]);
  const { data: bookings } = await sb.from("court_bookings").select("*").eq("booking_date", date);
  drawResaGrid(date, bookings || []);
}

function drawResaGrid(date, bookings) {
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
        el.textContent = b.title || kindLabel(b.kind);
        el.title = (b.title || kindLabel(b.kind)) + (b.recurrence_id ? " · série" : "");
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
  const { data, error } = await sb
    .from("people").select("*")
    .order("last_name").order("first_name");
  if (error) { alert("Erreur chargement : " + error.message); return; }
  people = data || [];
  renderRows();
}

function renderRows() {
  const q = $("search").value.trim().toLowerCase();
  const rows = people.filter((p) =>
    !q || (`${p.first_name} ${p.last_name} ${p.email || ""}`).toLowerCase().includes(q)
  );
  const tbody = $("people-rows");
  tbody.innerHTML = "";
  $("empty-msg").hidden = rows.length > 0;
  for (const p of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(p.last_name)} ${esc(p.first_name)}</td>
      <td>${esc(p.category || "")}</td>
      <td>${esc(p.email || "")}</td>
      <td>${esc(p.phone || "")}</td>
      <td>${p.is_active ? "✓" : "—"}</td>`;
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
  $("p-category").value = p?.category || "";
  $("p-email").value = p?.email || "";
  $("p-phone").value = p?.phone || "";
  $("p-address").value = p?.address || "";
  $("p-postal").value = p?.postal_code || "";
  $("p-city").value = p?.city || "";
  $("p-bexio").value = p?.bexio_contact_id || "";
  $("p-active").checked = p ? p.is_active : true;
  $("p-notes").value = p?.notes || "";
  $("family-section").classList.toggle("hidden", !p);
  $("credit-section").classList.toggle("hidden", !p);
  if (p) { populateFamPersons(p.id); loadFamily(p.id); loadCredit(p.id); }
  $("person-modal").classList.remove("hidden");
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
    `<div class="cr-row"><span>${(r.created_at || "").slice(0, 10)} · ${esc(r.reason || "")}</span>
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
    const label = isParent ? `Enfant : ${nameOf(other)}` : `Parent/tuteur : ${nameOf(other)}`;
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
  const row = $("fam-dir").value === "child"
    ? { guardian_id: id, child_id: other, relation: "parent" }
    : { guardian_id: other, child_id: id, relation: "parent" };
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

  $("ct-add-btn").addEventListener("click", addType);
  $("cs-date").value = isoA(new Date());
  $("cs-date").addEventListener("change", loadCoursesDay);
  $("cs-prev").addEventListener("click", () => shiftCs(-1));
  $("cs-next").addEventListener("click", () => shiftCs(1));
  $("cs-new").addEventListener("click", () => openCourse(null));
  $("cs-copy").addEventListener("click", copyWeek);
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

async function loadCoursesDay() {
  const date = $("cs-date").value;
  const { data: courses } = await sb.from("courses").select("*").eq("course_date", date).order("start_time");
  const ids = (courses || []).map((c) => c.id);
  let books = [], coaches = [], parts = [];
  if (ids.length) {
    [books, coaches, parts] = await Promise.all([
      sb.from("court_bookings").select("court_id,course_id").in("course_id", ids).then((r) => r.data || []),
      sb.from("course_coaches").select("course_id,coach_person_id").in("course_id", ids).then((r) => r.data || []),
      sb.from("course_participants").select("course_id,child_person_id").in("course_id", ids).then((r) => r.data || []),
    ]);
  }
  const courtName = (id) => (resaCourtsAll.find((c) => c.id === id)?.name || "?").replace("Court ", "C");
  $("cs-list").innerHTML = (courses || []).length ? (courses || []).map((c) => {
    const cts = books.filter((b) => b.course_id === c.id).map((b) => courtName(b.court_id)).join(", ");
    const nc = coaches.filter((x) => x.course_id === c.id).length;
    const np = parts.filter((x) => x.course_id === c.id).length;
    const type = courseTypes.find((t) => t.id === c.course_type_id);
    return `<div class="cs-card" data-id="${c.id}" style="border-left-color:${c.color || (type?.color) || "#0b6b3a"}">
      <div class="cs-time">${c.start_time.slice(0, 5)}–${c.end_time.slice(0, 5)}</div>
      <div class="cs-main"><b>${esc(c.title || type?.name || "Cours")}</b>
        <span class="muted">${type ? esc(type.name) + " · " : ""}Courts ${cts || "—"}</span></div>
      <div class="cs-badges"><span>${nc} coach(s)</span><span>${np} élève(s)</span></div>
      <button type="button" class="att-btn" data-att="${c.id}">Présences</button>
    </div>`;
  }).join("") : '<p class="muted">Aucun cours ce jour.</p>';
  if (isHeadUser) $("cs-list").querySelectorAll(".cs-card").forEach((el) =>
    el.addEventListener("click", () => editCourse(el.dataset.id)));
  $("cs-list").querySelectorAll(".att-btn").forEach((b) =>
    b.addEventListener("click", (e) => { e.stopPropagation(); openAttendance(b.dataset.att); }));
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
    `<tr><td>${(r.created_at || "").slice(0, 10)}</td><td>${esc(r.label || "—")}</td>
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
      <td>${esc(s.name)}</td><td>${s.start_date}</td><td>${s.end_date}</td><td>${weeks}</td>
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
  renderChips("c-coaches", people.filter((p) => p.category === "staff").map((p) => [p.id, `${p.last_name} ${p.first_name}`]), related?.coaches);
  renderChips("c-children", people.filter((p) => p.category === "junior").map((p) => [p.id, `${p.last_name} ${p.first_name}`]), related?.children);
  updateCount();
  $("c-del").classList.toggle("hidden", !course);
  $("course-modal").classList.remove("hidden");
}

async function editCourse(id) {
  const course = (await sb.from("courses").select("*").eq("id", id).single()).data;
  const [courts, coaches, children] = await Promise.all([
    sb.from("court_bookings").select("court_id").eq("course_id", id).then((r) => (r.data || []).map((x) => String(x.court_id))),
    sb.from("course_coaches").select("coach_person_id").eq("course_id", id).then((r) => (r.data || []).map((x) => x.coach_person_id)),
    sb.from("course_participants").select("child_person_id").eq("course_id", id).then((r) => (r.data || []).map((x) => x.child_person_id)),
  ]);
  openCourse(course, { courts, coaches, children });
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

async function copyWeek() {
  const srcMon = mondayOf($("cs-date").value);
  const srcEnd = addDays(srcMon, 6);
  const suggestion = addDays(srcMon, 7);
  const target = prompt(`Copier TOUS les cours de la semaine du ${srcMon} vers quelle semaine ?\nEntrez une date de la semaine cible (AAAA-MM-JJ) :`, suggestion);
  if (!target) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) { alert("Date invalide (format AAAA-MM-JJ)."); return; }
  const tgtMon = mondayOf(target);
  const offset = Math.round((new Date(tgtMon) - new Date(srcMon)) / 86400000);
  if (offset === 0) { alert("C'est la même semaine."); return; }

  const { data: courses } = await sb.from("courses").select("*").gte("course_date", srcMon).lte("course_date", srcEnd);
  if (!courses || !courses.length) { alert("Aucun cours dans cette semaine."); return; }
  const ids = courses.map((c) => c.id);
  const [books, coaches, parts] = await Promise.all([
    sb.from("court_bookings").select("course_id,court_id").in("course_id", ids).then((r) => r.data || []),
    sb.from("course_coaches").select("course_id,coach_person_id").in("course_id", ids).then((r) => r.data || []),
    sb.from("course_participants").select("course_id,child_person_id").in("course_id", ids).then((r) => r.data || []),
  ]);

  // Pass 1 : détecter les conflits (aucune écriture)
  const toCreate = [], conflicts = [];
  for (const c of courses) {
    const newDate = addDays(c.course_date, offset);
    const courts = books.filter((b) => b.course_id === c.id).map((b) => b.court_id);
    const { data: clash } = await sb.from("court_bookings").select("court_id")
      .eq("booking_date", newDate).in("court_id", courts)
      .lt("start_time", c.end_time).gt("end_time", c.start_time);
    if (clash && clash.length) conflicts.push(`${newDate} ${c.start_time.slice(0, 5)} — ${c.title || "cours"}`);
    else toCreate.push({ c, newDate, courts });
  }

  // Avertissement AVANT toute écriture
  let msg = `Semaine cible : ${tgtMon}.\n${toCreate.length} cours à copier.`;
  if (conflicts.length) msg += `\n\n${conflicts.length} cours en CONFLIT (ignorés, rien ne sera écrasé) :\n` + conflicts.join("\n");
  if (!toCreate.length) { alert(msg + "\n\nRien à copier."); return; }
  if (!confirm(msg + "\n\nContinuer ?")) return;

  // Pass 2 : créer les cours sans conflit
  let created = 0;
  for (const { c, newDate, courts } of toCreate) {
    const { data: nc } = await sb.from("courses").insert({
      course_type_id: c.course_type_id, title: c.title, course_date: newDate,
      start_time: c.start_time, end_time: c.end_time, color: c.color, created_by: meId,
    }).select("id").single();
    if (!nc) continue;
    for (const court of courts) await sb.from("court_bookings").insert({
      court_id: court, booking_date: newDate, start_time: c.start_time, end_time: c.end_time,
      kind: "cours", title: c.title || "Cours", color: c.color, created_by: meId, course_id: nc.id,
    });
    const cs = coaches.filter((x) => x.course_id === c.id).map((x) => ({ course_id: nc.id, coach_person_id: x.coach_person_id }));
    if (cs.length) await sb.from("course_coaches").insert(cs);
    const ps = parts.filter((x) => x.course_id === c.id).map((x) => ({ course_id: nc.id, child_person_id: x.child_person_id }));
    if (ps.length) await sb.from("course_participants").insert(ps);
    created++;
  }
  alert(`✓ ${created} cours copiés vers la semaine du ${tgtMon}.` + (conflicts.length ? `\n${conflicts.length} ignoré(s) pour conflit.` : ""));
  loadCoursesDay();
}
function failC(el, msg) { el.textContent = msg; el.hidden = false; }

function closePerson() { $("person-modal").classList.add("hidden"); }

async function savePerson(e) {
  e.preventDefault();
  const err = $("person-error");
  err.hidden = true;
  const row = {
    first_name: $("p-first").value.trim(),
    last_name: $("p-last").value.trim(),
    birthdate: $("p-birth").value || null,
    gender: $("p-gender").value || null,
    category: $("p-category").value || null,
    email: $("p-email").value.trim() || null,
    phone: $("p-phone").value.trim() || null,
    address: $("p-address").value.trim() || null,
    postal_code: $("p-postal").value.trim() || null,
    city: $("p-city").value.trim() || null,
    bexio_contact_id: $("p-bexio").value ? Number($("p-bexio").value) : null,
    is_active: $("p-active").checked,
    notes: $("p-notes").value.trim() || null,
  };
  const id = $("p-id").value;
  const q = id
    ? sb.from("people").update(row).eq("id", id)
    : sb.from("people").insert(row);
  const { error } = await q;
  if (error) { err.textContent = "Enregistrement impossible : " + error.message; err.hidden = false; return; }
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
let stgCats = [], stgSessions = [], stgCounts = {}, stgCurrent = null, stgRegs = [];

const stgDays = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
const stgEffPrice = (price, days) => Math.round(Number(price) * Math.min(days, 5) / 5 * 100) / 100;
const stgCatById = (id) => stgCats.find((c) => c.id === id) || {};

function initStages() {
  document.querySelectorAll("#view-stages .stg-subtab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#view-stages .stg-subtab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("#view-stages .stg-sub").forEach((s) => s.classList.toggle("hidden", s.id !== "stg-sub-" + b.dataset.sub));
      if (b.dataset.sub === "stages") loadStagesTab();
      if (b.dataset.sub === "mails") loadStageMails();
      if (b.dataset.sub === "questionnaires") loadSurveyTab("stage");
    }));
  $("stg-cat-new").addEventListener("click", createStageCat);
  $("stg-new").addEventListener("click", createStage);
  $("stg-detail-back").addEventListener("click", closeStageDetail);
  $("stg-program-save").addEventListener("click", saveProgram);
  $("stg-reg-add").addEventListener("click", addRegistrant);
  $("stg-survey-new").addEventListener("click", () => createSurvey("stage"));
  $("stg-mail-cat").addEventListener("change", () => renderStageMails($("stg-mail-cat").value));
}

async function loadStagesTab() {
  const [{ data: cats }, { data: sessions }, { data: regs }] = await Promise.all([
    sb.from("stage_categories").select("*").order("sort_order"),
    sb.from("stage_sessions").select("*").order("start_date", { ascending: false }),
    sb.from("stage_registrations").select("stage_id"),
  ]);
  stgCats = cats || [];
  stgSessions = sessions || [];
  stgCounts = {};
  for (const r of regs || []) stgCounts[r.stage_id] = (stgCounts[r.stage_id] || 0) + 1;
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
  const name = prompt("Nom de la catégorie :");
  if (!name) return;
  const sort = (stgCats.at(-1)?.sort_order || stgCats.length) + 1;
  const { error } = await sb.from("stage_categories").insert({ name, sort_order: sort });
  if (error) return alert(error.message);
  loadStagesTab();
}

async function saveStageCat(id, card) {
  const patch = {
    name: card.querySelector(".stg-cat-name").value.trim(),
    description: card.querySelector(".stg-cat-desc").value.trim() || null,
    price: Number(card.querySelector(".stg-cat-price").value) || 0,
    meal: card.querySelector(".stg-cat-meal").checked,
    tshirt: card.querySelector(".stg-cat-tshirt").checked,
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

function renderStageList() {
  $("stg-rows").innerHTML = stgSessions.map((s) => {
    const cat = stgCatById(s.category_id);
    const days = stgDays(s.start_date, s.end_date);
    const price = stgEffPrice(cat.price || 0, days);
    const dates = s.start_date === s.end_date ? s.start_date : `${s.start_date} → ${s.end_date}`;
    return `<tr class="stg-row" data-id="${s.id}">
      <td><b>${esc(s.title || cat.name || "Stage")}</b></td>
      <td>${esc(cat.name || "—")}</td>
      <td>${dates}</td>
      <td>${days}${days < 5 ? " <span class='muted'>(pro-rata)</span>" : ""}</td>
      <td>${price} CHF</td>
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
  }).join("") || '<tr><td colspan="7" class="muted">Aucun stage.</td></tr>';
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

async function createStage() {
  if (!stgCats.length) return alert("Crée d'abord une catégorie.");
  const catName = prompt("Catégorie du stage — tape le nom exact parmi :\n" + stgCats.map((c) => c.name).join(", "), stgCats[0].name);
  if (!catName) return;
  const cat = stgCats.find((c) => c.name.toLowerCase() === catName.trim().toLowerCase());
  if (!cat) return alert("Catégorie introuvable.");
  const start = prompt("Date de début (AAAA-MM-JJ) :");
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return alert("Date de début invalide.");
  const end = prompt("Date de fin (AAAA-MM-JJ) :", start);
  if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return alert("Date de fin invalide.");
  if (end < start) return alert("La date de fin précède le début.");
  const { error } = await sb.from("stage_sessions").insert({ category_id: cat.id, start_date: start, end_date: end });
  if (error) return alert(error.message);
  loadStagesTab();
}

// ---- Détail d'un stage : inscrits + programme ----
async function openStage(id) {
  stgCurrent = id;
  const s = stgSessions.find((x) => x.id === id);
  const cat = stgCatById(s.category_id);
  const days = stgDays(s.start_date, s.end_date);
  const price = stgEffPrice(cat.price || 0, days);
  $("stg-detail-title").textContent = (s.title || cat.name || "Stage");
  $("stg-detail-meta").innerHTML = `${esc(cat.name || "")} · ${s.start_date}${s.end_date !== s.start_date ? " → " + s.end_date : ""} · ${days} jour(s) · <b>${price} CHF</b>${days < 5 ? " (pro-rata)" : ""}${cat.meal ? " · repas" : ""}${cat.tshirt ? " · t-shirt" : ""}`;
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

function renderRegistrants() {
  const s = stgSessions.find((x) => x.id === stgCurrent);
  const cat = stgCatById(s.category_id);
  const base = stgEffPrice(cat.price || 0, stgDays(s.start_date, s.end_date));
  $("stg-reg-count").textContent = stgRegs.length;
  $("stg-reg-rows").innerHTML = stgRegs.map((r) => {
    const price = Math.round(base * (1 - r.discount_pct / 100) * 100) / 100;
    const rebate = r.discount_pct ? `−${r.discount_pct}% <span class="muted">(${esc(r.discount_reason || "")})</span> <button class="fam-del stg-reb-del" data-id="${r.id}">✕</button>`
      : `<button class="ghost stg-reb-add" data-id="${r.id}">−20%</button>`;
    const invoice = r.invoice_created
      ? `<span class="muted">Facturé${r.invoice_sent_at ? " le " + r.invoice_sent_at.slice(0, 10) : ""}</span>`
      : `<button class="ghost stg-inv" data-id="${r.id}">Créer facture + mail</button>`;
    return `<tr data-id="${r.id}">
      <td><b>${esc(r.first_name)} ${esc(r.last_name)}</b></td>
      <td>${r.birth_date || "—"}</td>
      <td>${esc(r.email || "—")}</td>
      <td>${cat.tshirt ? esc(r.tshirt_size || "—") : "—"}</td>
      <td>${cat.meal ? esc(r.meal_restriction || "—") : "—"}</td>
      <td class="stg-cmt">${esc(r.comment || "")}</td>
      <td>${rebate}</td>
      <td><b>${price}</b></td>
      <td>${invoice}</td>
      <td><input type="checkbox" class="stg-paid" data-id="${r.id}" ${r.paid ? "checked" : ""}/></td>
      <td><button class="fam-del stg-reg-del" data-id="${r.id}">✕</button></td>
    </tr>`;
  }).join("") || '<tr><td colspan="11" class="muted">Aucun inscrit.</td></tr>';
  const T = $("stg-reg-rows");
  T.querySelectorAll(".stg-reb-add").forEach((b) => b.addEventListener("click", () => setDiscount(b.dataset.id)));
  T.querySelectorAll(".stg-reb-del").forEach((b) => b.addEventListener("click", () => removeDiscount(b.dataset.id)));
  T.querySelectorAll(".stg-inv").forEach((b) => b.addEventListener("click", () => createInvoice(b.dataset.id)));
  T.querySelectorAll(".stg-paid").forEach((c) => c.addEventListener("change", () => togglePaid(c.dataset.id, c.checked)));
  T.querySelectorAll(".stg-reg-del").forEach((b) => b.addEventListener("click", () => delRegistrant(b.dataset.id)));
}

async function addRegistrant() {
  const first = prompt("Prénom :"); if (!first) return;
  const last = prompt("Nom :"); if (!last) return;
  const email = prompt("Email (optionnel) :") || null;
  const birth = prompt("Date de naissance (AAAA-MM-JJ, optionnel) :") || null;
  const { error } = await sb.from("stage_registrations").insert({ stage_id: stgCurrent, first_name: first.trim(), last_name: last.trim(), email, birth_date: birth && /^\d{4}-\d{2}-\d{2}$/.test(birth) ? birth : null });
  if (error) return alert(error.message);
  stgCounts[stgCurrent] = (stgCounts[stgCurrent] || 0) + 1;
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

