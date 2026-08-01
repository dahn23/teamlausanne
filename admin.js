// Console admin — CRM membres (accès staff uniquement).
import { sb, requireLogin, myRoles, hasAny, STAFF_ROLES } from "./common.js";

const $ = (id) => document.getElementById(id);
let people = [];

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
    init();
  }
}

function init() {
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
  loadSettings();
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
