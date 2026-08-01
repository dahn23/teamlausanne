// Page publique : ouverture/fermeture de la fenêtre de connexion + redirection
// après login (les membres vont vers la réservation).
import { sb, getSession } from "./common.js";

const $ = (id) => document.getElementById(id);
const modal = $("login-modal");

const openModal = () => modal.classList.remove("hidden");
const closeModal = () => modal.classList.add("hidden");

$("open-login").addEventListener("click", openModal);
$("hero-login").addEventListener("click", openModal);
$("close-login").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

// Déjà connecté ? On file directement à la réservation.
getSession().then((session) => { if (session) location.href = "reservation.html"; });

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("login-error");
  err.hidden = true;
  $("login-btn").disabled = true;
  const { error } = await sb.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value,
  });
  $("login-btn").disabled = false;
  if (error) {
    err.textContent = "Connexion impossible : " + error.message;
    err.hidden = false;
    return;
  }
  location.href = "reservation.html";
});
