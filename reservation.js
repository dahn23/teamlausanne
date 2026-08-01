// Grille de réservation (accès membre connecté).
import { sb, requireLogin, myRoles, hasAny, STAFF_ROLES } from "./common.js";
import { HOUR_START, HOUR_END } from "./config.js";

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => new Date().toISOString().slice(0, 10);

let me = null;
let courts = [];

// Saison d'une date (même règle que season_of() en base).
function seasonOf(iso) {
  const [, m, d] = iso.split("-").map(Number);
  const md = m * 100 + d;
  return (md >= 415 && md < 1015) ? "ete" : "hiver";
}

// ---- Garde d'accès ----
const session = await requireLogin();
if (session) {
  me = session.user;
  $("who").textContent = me.email;
  const roles = await myRoles();
  if (hasAny(roles, STAFF_ROLES)) $("admin-link").classList.remove("hidden");
  init();
}

function init() {
  $("logout").addEventListener("click", async () => {
    await sb.auth.signOut();
    location.href = "index.html";
  });
  $("date").value = todayISO();
  $("date").addEventListener("change", loadDay);
  $("prev-day").addEventListener("click", () => shiftDay(-1));
  $("next-day").addEventListener("click", () => shiftDay(1));
  loadDay();
}

function shiftDay(delta) {
  const d = new Date($("date").value + "T00:00:00");
  d.setDate(d.getDate() + delta);
  $("date").value = d.toISOString().slice(0, 10);
  loadDay();
}

async function loadDay() {
  const date = $("date").value;
  const season = seasonOf(date);
  $("season-tag").textContent = season === "ete" ? "☀️ Été" : "❄️ Hiver";

  const seasonCol = season === "ete" ? "open_summer" : "open_winter";
  const { data: allCourts, error: cErr } = await sb
    .from("courts").select("*")
    .eq("is_active", true).eq(seasonCol, true)
    .order("display_order");
  if (cErr) { alert("Erreur courts : " + cErr.message); return; }
  courts = allCourts;

  const { data: bookings, error: bErr } = await sb
    .from("court_bookings").select("*")
    .eq("booking_date", date);
  if (bErr) { alert("Erreur réservations : " + bErr.message); return; }

  drawGrid(date, bookings);
}

function drawGrid(date, bookings) {
  const grid = $("grid");
  const hours = [];
  for (let h = HOUR_START; h < HOUR_END; h++) hours.push(h);

  grid.style.gridTemplateColumns = `minmax(84px,auto) repeat(${hours.length},1fr)`;
  grid.innerHTML = "";

  grid.appendChild(cell("", "cell head"));
  for (const h of hours) grid.appendChild(cell(pad(h) + "h", "cell colhead"));

  for (const court of courts) {
    grid.appendChild(cell(court.name, "cell head"));
    for (const h of hours) {
      const start = pad(h) + ":00:00";
      const b = bookings.find(
        (x) => x.court_id === court.id && x.start_time <= start && x.end_time > start
      );
      const el = document.createElement("div");
      el.className = "cell slot";
      if (!b) {
        el.addEventListener("click", () => book(court, date, h));
      } else if (b.created_by === me.id) {
        el.classList.add("mine");
        el.textContent = "Vous";
        el.addEventListener("click", () => cancel(b, court, h));
      } else {
        el.classList.add("busy");
        if (b.kind === "cours") { el.classList.add("cours"); el.textContent = b.title || "Cours"; }
        else el.textContent = "Occupé";
      }
      grid.appendChild(el);
    }
  }
}

function cell(text, cls) {
  const el = document.createElement("div");
  el.className = cls;
  el.textContent = text;
  return el;
}

async function book(court, date, hour) {
  if (!confirm(`Réserver ${court.name} le ${date} de ${pad(hour)}h à ${pad(hour + 1)}h ?`)) return;
  const { error } = await sb.from("court_bookings").insert({
    court_id: court.id,
    booking_date: date,
    start_time: pad(hour) + ":00:00",
    end_time: pad(hour + 1) + ":00:00",
    kind: "libre",
    created_by: me.id,
  });
  if (error) {
    alert(error.code === "23P01"
      ? "Ce créneau vient d'être pris."
      : "Réservation impossible : " + error.message);
  }
  loadDay();
}

async function cancel(booking, court, hour) {
  if (!confirm(`Annuler votre réservation de ${court.name} à ${pad(hour)}h ?`)) return;
  const { error } = await sb.from("court_bookings").delete().eq("id", booking.id);
  if (error) alert("Annulation impossible : " + error.message);
  loadDay();
}
