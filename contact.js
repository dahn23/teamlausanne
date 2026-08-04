// Page de contact : écrit dans contact_messages (source = sujet choisi).
// Envoi mail réel vers info@teamlausanne.ch = prod SMTP.
import { sb } from "./common.js";
import "./pretty-select.js";

const $ = (id) => document.getElementById(id);

// Présélection du sujet selon d'où vient la personne (?src=…)
const rawSrc = new URLSearchParams(location.search).get("src") || "";
const src = rawSrc.toLowerCase();
const options = [...$("c-subject").options].map((o) => o.value);
const map = [
  [/stage/, "Renseignement pour les stages"],
  [/partenaire|sponsor|privatis/, "Sponsoring & partenariat"],
  [/président|president/, "Club des Présidents"],
  [/vip|lunch/, "Lunch VIP du Lausanne Open"],
  [/junior|kids|compétition|competition|performance/, "Cours juniors"],
  [/academy|académie|sport|pro/, "Renseignement pour l'Academy"],
  [/réserv|reserv|court/, "Réservation de courts"],
  [/factur/, "Facturation"],
  [/club/, "Inscription au club"],
];
// D'abord un match exact avec une option, sinon par mots-clés.
const preset = options.find((v) => v.toLowerCase() === src) || (map.find(([re]) => re.test(src)) || [])[1];
if (preset && options.includes(preset)) $("c-subject").value = preset;

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
