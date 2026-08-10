// Club des Présidents : formulaire de contact dédié → contact_messages.
// L'entreprise/fonction et le téléphone sont ajoutés au message (pas de colonne dédiée).
import { sb } from "./common.js";

const $ = (id) => document.getElementById(id);

$("p-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("p-error"); err.hidden = true;
  const btn = $("p-btn"); btn.disabled = true; btn.textContent = "Envoi…";

  const parts = [];
  if ($("p-company").value.trim()) parts.push("Entreprise / fonction : " + $("p-company").value.trim());
  if ($("p-phone").value.trim()) parts.push("Téléphone : " + $("p-phone").value.trim());
  const msg = $("p-message").value.trim();
  if (msg) { if (parts.length) parts.push(""); parts.push(msg); }

  const { error } = await sb.from("contact_messages").insert({
    source: "Club des Présidents",
    name: $("p-name").value.trim(),
    email: $("p-email").value.trim(),
    message: parts.join("\n") || null,
  });

  btn.disabled = false; btn.textContent = "Envoyer ma demande";
  if (error) { err.textContent = "Erreur : " + error.message; err.hidden = false; return; }
  $("p-form").classList.add("hidden");
  $("p-done").classList.remove("hidden");
});
