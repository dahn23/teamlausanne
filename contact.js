// Page de contact : écrit dans contact_messages (source = sujet choisi).
// Envoi mail réel vers info@teamlausanne.ch = prod SMTP.
import { sb } from "./common.js";

const $ = (id) => document.getElementById(id);

// Présélection du sujet selon d'où vient la personne (?src=…)
const src = (new URLSearchParams(location.search).get("src") || "").toLowerCase();
const map = [
  [/partenaire|sponsor|privatis/, "Sponsoring & partenariat"],
  [/président|president/, "Club des Présidents"],
  [/vip|lunch/, "Lunch VIP du Lausanne Open"],
  [/academy|académie/, "Renseignement pour l'Academy"],
  [/junior|cours/, "Cours juniors"],
  [/réserv|reserv|court/, "Réservation de courts"],
  [/factur/, "Facturation"],
  [/club/, "Inscription au club"],
];
const preset = (map.find(([re]) => re.test(src)) || [])[1];
if (preset) {
  const opt = [...$("c-subject").options].find((o) => o.value === preset);
  if (opt) $("c-subject").value = preset;
}

$("c-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("c-error"); err.hidden = true;
  const btn = $("c-btn"); btn.disabled = true; btn.textContent = "Envoi…";
  const { error } = await sb.from("contact_messages").insert({
    source: $("c-subject").value,
    name: $("c-name").value.trim(),
    email: $("c-email").value.trim(),
    message: $("c-message").value.trim() || null,
  });
  btn.disabled = false; btn.textContent = "Envoyer";
  if (error) { err.textContent = "Erreur : " + error.message; err.hidden = false; return; }
  $("c-form").classList.add("hidden");
  $("c-done").classList.remove("hidden");
});
