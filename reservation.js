// Grille de réservation PUBLIQUE (visible sans login).
// Courts en colonnes, heures en :15 (08:15 → 21:15). Prix et couleurs
// (creuse/pleine) calculés depuis les réglages paramétrables (app_settings).
import { sb, getSession, myRoles, hasAny, STAFF_ROLES } from "./common.js";

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
// Date locale au format YYYY-MM-DD (évite le décalage UTC de toISOString).
const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => isoLocal(new Date());

let me = null;
let isMember = false;       // membre ou staff → tarif membre
let settings = {};
let courts = [];
let membersList = [];       // annuaire des membres (choix du partenaire)
let invitationsUsed = 0;    // invitations déjà utilisées cette saison d'été
let pending = null;         // créneau en cours de réservation

// ---- Réglages ----
async function loadSettings() {
  const { data } = await sb.from("app_settings").select("key,value");
  settings = {};
  for (const r of data || []) settings[r.key] = r.value;
}

// Saison d'une date selon les dates paramétrables (hiver = 19.10 → 11.04).
function seasonOf(iso) {
  const s = settings.season || { winter_start: "2026-10-19", winter_end: "2027-04-11" };
  const md = (d) => Number(d.slice(5, 7)) * 100 + Number(d.slice(8, 10));
  const x = md(iso), a = md(s.winter_start), b = md(s.winter_end);
  return (x >= a || x <= b) ? "hiver" : "ete";
}

function weekday(iso) { // 1 = lundi … 7 = dimanche
  const d = new Date(iso + "T00:00:00").getDay(); // 0 = dim
  return d === 0 ? 7 : d;
}

function isPeak(iso, hour) {
  const peak = settings.peak || {};
  const list = peak[String(weekday(iso))] || [];
  return list.includes(hour);
}

function zoneOf(court, season) {
  if (season === "hiver") return "hiver";
  return court.location === "indoor" ? "ete_halle" : "ete_ext";
}

function priceFor(court, iso, hour, season, category) {
  const pricing = settings.pricing;
  if (!pricing) return null;
  const z = pricing[zoneOf(court, season)];
  if (!z) return null;
  const row = z[isPeak(iso, hour) ? "pleine" : "creuse"];
  return row[category];
}

// ===================================================================
//  Init (public : pas de redirection)
// ===================================================================
const session = await getSession();
me = session?.user ?? null;
if (me) {
  $("who").textContent = me.email;
  $("login-top").classList.add("hidden");
  $("logout").classList.remove("hidden");
  const roles = await myRoles();
  isMember = hasAny(roles, [...STAFF_ROLES, "membre"]);
  if (hasAny(roles, STAFF_ROLES)) $("admin-link").classList.remove("hidden");
}
await loadSettings();
if (me && isMember) await loadMemberData();
initUI();
loadDay();

async function loadMemberData() {
  const { data: mem } = await sb.rpc("list_members");
  membersList = mem || [];
  const sel = $("partner-select");
  sel.innerHTML = '<option value="">— Choisir un membre —</option>' +
    membersList.filter((m) => m.person_id).map((m) =>
      `<option value="${m.person_id}">${m.full_name}</option>`).join("");
  // invitations utilisées cette saison d'été
  const { data: inv } = await sb.from("court_bookings")
    .select("booking_date,is_invitation").eq("created_by", me.id).eq("is_invitation", true);
  invitationsUsed = (inv || []).filter((b) => seasonOf(b.booking_date) === "ete").length;
}

function initUI() {
  $("date").value = todayISO();
  $("date").addEventListener("change", loadDay);
  $("prev-day").addEventListener("click", () => shiftDay(-1));
  $("next-day").addEventListener("click", () => shiftDay(1));
  $("login-top").addEventListener("click", openLogin);
  $("logout").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });

  // modales
  $("close-login").addEventListener("click", () => $("login-modal").classList.add("hidden"));
  $("login-modal").addEventListener("click", (e) => { if (e.target === $("login-modal")) $("login-modal").classList.add("hidden"); });
  document.querySelector("[data-close-choice]").addEventListener("click", () => $("choice-modal").classList.add("hidden"));
  $("choice-modal").addEventListener("click", (e) => { if (e.target === $("choice-modal")) $("choice-modal").classList.add("hidden"); });
  $("choice-login").addEventListener("click", () => { $("choice-modal").classList.add("hidden"); openLogin(); });
  $("choice-guest").addEventListener("click", () =>
    alert("Réservation invité avec paiement en ligne (Twint / carte) : disponible très bientôt."));

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("login-error"); err.hidden = true; $("login-btn").disabled = true;
    const { error } = await sb.auth.signInWithPassword({
      email: $("email").value.trim(), password: $("password").value });
    $("login-btn").disabled = false;
    if (error) { err.textContent = "Connexion impossible : " + error.message; err.hidden = false; return; }
    location.reload();
  });

  // ---- Modale partenaire (membre) ----
  document.querySelector("[data-close-partner]").addEventListener("click", closePartner);
  $("partner-modal").addEventListener("click", (e) => { if (e.target === $("partner-modal")) closePartner(); });
  document.querySelectorAll('input[name="ptype"]').forEach((r) =>
    r.addEventListener("change", refreshPartner));
  $("partner-confirm").addEventListener("click", confirmPartner);
}

function openLogin() { $("login-modal").classList.remove("hidden"); }

function shiftDay(delta) {
  const d = new Date($("date").value + "T00:00:00");
  d.setDate(d.getDate() + delta);
  $("date").value = isoLocal(d);
  loadDay();
}

async function loadDay() {
  const date = $("date").value;
  const season = seasonOf(date);
  $("season-tag").textContent = season === "ete" ? "☀️ Été" : "❄️ Hiver";

  const col = season === "ete" ? "open_summer" : "open_winter";
  const { data: allCourts, error: cErr } = await sb.from("courts").select("*")
    .eq("is_active", true).eq(col, true).order("display_order");
  if (cErr) { alert("Erreur courts : " + cErr.message); return; }
  courts = allCourts;

  const { data: bookings, error: bErr } = await sb.from("court_bookings").select("*")
    .eq("booking_date", date);
  if (bErr) { alert("Erreur réservations : " + bErr.message); return; }

  drawGrid(date, season, bookings);
}

function drawGrid(date, season, bookings) {
  const grid = $("rgrid");
  const hours = [];
  for (let h = 8; h <= 21; h++) hours.push(h);

  grid.style.gridTemplateColumns = `64px repeat(${courts.length}, minmax(72px,1fr))`;
  grid.innerHTML = "";

  // en-tête : coin + noms de courts
  grid.appendChild(cell("", "rcell corner"));
  for (const c of courts) grid.appendChild(cell(c.name.replace("Court ", "C"), "rcell rhead", c.surface));

  for (const h of hours) {
    grid.appendChild(cell(pad(h) + ":15", "rcell rhour"));
    for (const c of courts) {
      const slotStart = pad(h) + ":15:00", slotEnd = pad(h + 1) + ":15:00";
      // chevauchement partiel = créneau bloqué (un cours coupé occupe l'heure entière côté membre)
      const b = bookings.find((x) => x.court_id === c.id && x.start_time < slotEnd && x.end_time > slotStart);
      const el = document.createElement("div");
      el.className = "rcell rslot";
      if (b) {
        el.classList.add("busy");
        if (me && b.created_by === me.id) { el.classList.add("mine"); el.textContent = "Vous"; el.title = "Votre réservation — cliquez pour annuler";
          el.addEventListener("click", () => cancelBooking(b, c, h)); }
        else if (b.kind === "cours") { el.textContent = b.title || "Cours"; }
        else el.textContent = "Réservé";
      } else {
        el.classList.add(isPeak(date, h) ? "pleine" : "creuse");
        const price = priceFor(c, date, h, season, isMember ? "m_m" : "ext");
        const label = price == null ? "" : price === 0 ? "Gratuit" : price + " CHF";
        el.innerHTML = `<span class="pr">${label}</span>`;
        el.title = `${c.name} · ${pad(h)}:15–${pad(h + 1)}:15`;
        el.addEventListener("click", () => onSlot(c, date, h, price));
      }
      grid.appendChild(el);
    }
  }
}

function cell(text, cls, title) {
  const el = document.createElement("div");
  el.className = cls;
  el.textContent = text;
  if (title) el.title = title;
  return el;
}

function onSlot(court, date, hour, price) {
  if (me && isMember) return openPartner(court, date, hour);
  if (me) return bookSimple(court, date, hour, "ext");   // client connecté non-membre
  // visiteur non connecté → choix membre / invité
  $("choice-info").textContent = `${court.name} · le ${date} de ${pad(hour)}:15 à ${pad(hour + 1)}:15 · ${price ?? "?"} CHF (tarif externe)`;
  $("choice-modal").classList.remove("hidden");
}

// ---- Flux membre : choix du partenaire ----
function openPartner(court, date, hour) {
  pending = { court, date, hour, season: seasonOf(date) };
  $("partner-error").hidden = true;
  $("partner-slot").textContent = `${court.name} · le ${date} de ${pad(hour)}:15 à ${pad(hour + 1)}:15`;
  document.querySelector('input[name="ptype"][value="member"]').checked = true;
  $("partner-select").value = "";
  $("partner-guest-name").value = "";
  refreshPartner();
  $("partner-modal").classList.remove("hidden");
}
function closePartner() { $("partner-modal").classList.add("hidden"); }

function partnerType() {
  return document.querySelector('input[name="ptype"]:checked').value;
}

function refreshPartner() {
  const t = partnerType();
  $("partner-member-box").classList.toggle("hidden", t !== "member");
  $("partner-guest-box").classList.toggle("hidden", t !== "guest");
  const q = settings.quotas || {};
  const invMax = q.invitations_per_season_member ?? 2;
  if (t === "guest") {
    const left = Math.max(0, invMax - invitationsUsed);
    $("invite-note").textContent = `Invitations gratuites restantes cette saison d'été : ${left} / ${invMax}.`;
    $("partner-price").textContent = "Invitation — gratuit";
  } else {
    const p = priceFor(pending.court, pending.date, pending.hour, pending.season, "m_m");
    $("partner-price").textContent = p === 0 ? "Tarif membre : gratuit" : `Tarif membre : ${p} CHF`;
  }
}

async function confirmPartner() {
  const err = $("partner-error"); err.hidden = true;
  const q = settings.quotas || {};
  const { court, date, hour, season } = pending;
  const t = partnerType();

  // fenêtre de réservation à l'avance (membre)
  const days = Math.round((new Date(date + "T00:00:00") - new Date(todayISO() + "T00:00:00")) / 86400000);
  if (days > (q.advance_days_member ?? 7))
    return fail(err, `Un membre peut réserver au maximum ${q.advance_days_member ?? 7} jours à l'avance.`);
  if (days < 0) return fail(err, "Cette date est passée.");

  // heures simultanées
  const { count } = await sb.from("court_bookings")
    .select("id", { count: "exact", head: true })
    .eq("created_by", me.id).gte("booking_date", todayISO());
  if ((count ?? 0) >= (q.max_hours_member ?? 2))
    return fail(err, `Vous avez déjà ${q.max_hours_member ?? 2} réservation(s) en cours (maximum atteint).`);

  const row = {
    court_id: court.id, booking_date: date,
    start_time: pad(hour) + ":15:00", end_time: pad(hour + 1) + ":15:00",
    kind: "libre", created_by: me.id,
  };

  if (t === "guest") {
    if (invitationsUsed >= (q.invitations_per_season_member ?? 2))
      return fail(err, "Quota d'invitations gratuites atteint pour cette saison d'été.");
    row.is_invitation = true;
    row.partner_is_member = false;
    row.partner_name = $("partner-guest-name").value.trim() || null;
    row.payer_category = "m_guest";
    row.price_chf = 0;
  } else {
    const pid = $("partner-select").value;
    if (!pid) return fail(err, "Choisissez le membre avec qui vous jouez.");
    row.partner_person_id = pid;
    row.partner_is_member = true;
    row.partner_name = membersList.find((m) => m.person_id === pid)?.full_name || null;
    row.payer_category = "m_m";
    row.price_chf = priceFor(court, date, hour, season, "m_m");
  }

  const { error } = await sb.from("court_bookings").insert(row);
  if (error) return fail(err, error.code === "23P01" ? "Ce créneau vient d'être pris." : error.message);
  if (t === "guest") invitationsUsed++;
  closePartner();
  loadDay();
}

function fail(el, msg) { el.textContent = msg; el.hidden = false; }

// Client connecté non-membre : réservation simple (paiement à venir en phase 2)
async function bookSimple(court, date, hour) {
  alert("Le paiement en ligne (Twint / carte) pour les non-membres arrive très bientôt.");
}

async function cancelBooking(b, court, hour) {
  if (!confirm(`Annuler votre réservation de ${court.name} à ${pad(hour)}:15 ?`)) return;
  const { error } = await sb.from("court_bookings").delete().eq("id", b.id);
  if (error) alert("Annulation impossible : " + error.message);
  loadDay();
}
