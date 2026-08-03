// Page publique : liste des stages visibles + formulaire d'inscription.
// L'inscription est insérée en anonyme (RLS : stage visible, colonnes
// sensibles à leur défaut). L'anonyme ne relit pas les inscriptions.
import { sb } from "./common.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const days = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
const effPrice = (price, d) => Math.round(Number(price) * Math.min(d, 5) / 5 * 100) / 100;

let cats = {}, stages = [], current = null;

async function load() {
  const [{ data: cs }, { data: ss }] = await Promise.all([
    sb.from("stage_categories").select("*"),
    sb.from("stage_sessions").select("*").order("start_date"),
  ]);
  cats = {};
  for (const c of cs || []) cats[c.id] = c;
  stages = ss || [];
  render();
}

function render() {
  if (!stages.length) { $("stgp-list").innerHTML = '<p class="muted">Aucun stage ouvert aux inscriptions pour le moment. Reviens bientôt !</p>'; return; }
  $("stgp-list").innerHTML = stages.map((s) => {
    const c = cats[s.category_id] || {};
    const d = days(s.start_date, s.end_date);
    const price = effPrice(c.price || 0, d);
    const dates = s.start_date === s.end_date ? s.start_date : `${s.start_date} → ${s.end_date}`;
    const badges = `${c.meal ? '<span class="stg-tag">Repas inclus</span>' : ""}${c.tshirt ? '<span class="stg-tag">T-shirt offert</span>' : ""}`;
    return `<article class="stg-pub-card">
      ${c.image_url ? `<img src="${esc(c.image_url)}" alt="" class="stg-pub-img" loading="lazy"/>` : '<div class="stg-pub-img stg-pub-noimg"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M4.7 6.5c3.2 2 3.2 9 0 11M19.3 6.5c-3.2 2-3.2 9 0 11"/></svg></div>'}
      <div class="stg-pub-body">
        <h3>${esc(s.title || c.name || "Stage")}</h3>
        <div class="stg-pub-dates">${dates} · ${d} jour(s)</div>
        ${c.description ? `<p class="muted">${esc(c.description)}</p>` : ""}
        <div class="stg-pub-badges">${badges}</div>
        <div class="stg-pub-foot">
          <span class="stg-pub-price">${price} CHF</span>
          <button class="stg-pub-cta" data-id="${s.id}">S'inscrire</button>
        </div>
      </div>
    </article>`;
  }).join("");
  $("stgp-list").querySelectorAll(".stg-pub-cta").forEach((b) => b.addEventListener("click", () => openForm(b.dataset.id)));
}

function openForm(stageId) {
  current = stages.find((s) => s.id === stageId);
  const c = cats[current.category_id] || {};
  const d = days(current.start_date, current.end_date);
  const price = effPrice(c.price || 0, d);
  $("stgp-modal-title").textContent = current.title || c.name || "Stage";
  $("stgp-modal-meta").innerHTML = `${current.start_date}${current.end_date !== current.start_date ? " → " + current.end_date : ""} · <b>${price} CHF</b>`;
  $("f-tshirt-wrap").classList.toggle("hidden", !c.tshirt);
  $("f-meal-wrap").classList.toggle("hidden", !c.meal);
  $("stgp-form").reset();
  $("f-meal-text").disabled = true;
  $("stgp-form").classList.remove("hidden");
  $("stgp-done").classList.add("hidden");
  $("stgp-error").hidden = true;
  $("stgp-modal").classList.remove("hidden");
}

function closeForm() { $("stgp-modal").classList.add("hidden"); current = null; }

// Activer le champ texte quand « À préciser » est coché
document.addEventListener("change", (e) => {
  if (e.target.name === "meal") $("f-meal-text").disabled = e.target.value !== "autre";
});

$("stgp-close").addEventListener("click", closeForm);
$("stgp-modal").addEventListener("click", (e) => { if (e.target === $("stgp-modal")) closeForm(); });

$("stgp-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("stgp-error"); err.hidden = true;
  const c = cats[current.category_id] || {};
  let meal = null;
  if (c.meal) {
    const sel = document.querySelector('input[name="meal"]:checked')?.value;
    meal = sel === "autre" ? ($("f-meal-text").value.trim() || "À préciser") : "Aucune";
  }
  const row = {
    stage_id: current.id,
    first_name: $("f-first").value.trim(),
    last_name: $("f-last").value.trim(),
    email: $("f-email").value.trim(),
    birth_date: $("f-birth").value || null,
    tshirt_size: c.tshirt ? ($("f-tshirt").value || null) : null,
    meal_restriction: meal,
    comment: $("f-comment").value.trim() || null,
  };
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "Envoi…";
  const { error } = await sb.from("stage_registrations").insert(row);
  if (error) { err.textContent = "Erreur : " + error.message; err.hidden = false; btn.disabled = false; btn.textContent = "Envoyer mon inscription"; return; }
  $("stgp-form").classList.add("hidden");
  $("stgp-done").classList.remove("hidden");
});

load();
