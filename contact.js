// Page de contact : écrit dans contact_messages (source = d'où vient la
// demande, passée en ?src=). Envoi mail réel = prod SMTP.
import { sb } from "./common.js";

const $ = (id) => document.getElementById(id);
const CONTACT_TARGET = "info@teamlausanne.ch";
const src = new URLSearchParams(location.search).get("src") || "Contact";
$("c-src").textContent = "Formulaire : " + src + " → " + CONTACT_TARGET;

$("c-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("c-error"); err.hidden = true;
  const btn = $("c-btn"); btn.disabled = true; btn.textContent = "Envoi…";
  const { error } = await sb.from("contact_messages").insert({
    source: src,
    name: $("c-name").value.trim(),
    email: $("c-email").value.trim(),
    message: $("c-message").value.trim() || null,
  });
  btn.disabled = false; btn.textContent = "Envoyer";
  if (error) { err.textContent = "Erreur : " + error.message; err.hidden = false; return; }
  $("c-form").classList.add("hidden");
  $("c-done").classList.remove("hidden");
});
