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
  loadPeople();
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
