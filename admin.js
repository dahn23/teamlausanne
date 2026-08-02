// Console admin — CRM membres (accès staff uniquement).
import { sb, requireLogin, myRoles, hasAny, STAFF_ROLES } from "./common.js";

const $ = (id) => document.getElementById(id);
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
const TAB_ACCESS = {
  membres:  ["superadmin", "admin", "secretaire"],
  resa:     ["superadmin", "admin", "secretaire", "head_coach", "coach"],
  stats:    ["superadmin", "admin", "secretaire"],
  reglages: ["superadmin", "admin"],
};

function applyTabAccess(roles) {
  let first = null;
  document.querySelectorAll(".side-item[data-view]").forEach((b) => {
    const v = b.dataset.view;
    if (v === "bientot") return;
    const allowed = (TAB_ACCESS[v] || []).some((r) => roles.includes(r));
    b.classList.toggle("hidden", !allowed);
    if (allowed && !first) first = v;
  });
  if (first) showView(first);
}

async function init(roles) {
  applyTabAccess(roles);
  $("logout").addEventListener("click", async () => {
    await sb.auth.signOut();
    location.href = "index.html";
  });
  $("new-person").addEventListener("click", () => openPerson(null));
  $("close-person").addEventListener("click", closePerson);
  $("person-modal").addEventListener("click", (e) => { if (e.target === $("person-modal")) closePerson(); });
  $("person-form").addEventListener("submit", savePerson);
  $("delete-person").addEventListener("click", deletePerson);
  $("search").addEventListener("input", renderRows);
  document.querySelectorAll(".side-item[data-view]").forEach((b) =>
    b.addEventListener("click", () => showView(b.dataset.view)));
  $("rg-save").addEventListener("click", saveSettings);
  loadPeople();
  await loadSettings();
  initResa();
  initStats();
}

// ---- Bascule de vues ----
function showView(view) {
  if (view === "bientot") return;
  document.querySelectorAll(".side-item[data-view]").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach((v) =>
    v.classList.toggle("hidden", v.id !== "view-" + view));
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
  $("rg-inv").value = q.invitations_per_season_member ?? 2;
  $("rg-adv-m").value = q.advance_days_member ?? 7;
  $("rg-adv-nm").value = q.advance_days_nonmember ?? 3;

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
      invitations_per_season_member: Number($("rg-inv").value),
      advance_days_member: Number($("rg-adv-m").value), advance_days_nonmember: Number($("rg-adv-nm").value) } },
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

async function initResa() {
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
  $("resa-new").addEventListener("click", () => openResaCreate(resaCourtsAll[0]?.id, 8, 1));
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
  $("resa-season").textContent = season === "ete" ? "☀️ Été" : "❄️ Hiver";
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
  for (const c of resaCourts) grid.appendChild(rcell(c.name.replace("Court ", "C"), "rcell rhead"));

  for (let h = 8; h <= 21; h++) {
    grid.appendChild(rcell(pad2(h) + ":15", "rcell rhour"));
    for (const c of resaCourts) {
      const start = pad2(h) + ":15:00";
      const b = bookings.find((x) => x.court_id === c.id && x.start_time <= start && x.end_time > start);
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
  $("person-modal").classList.remove("hidden");
}

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
