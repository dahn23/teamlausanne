// Page de connexion épurée (app.teamlausanne.ch) — uniquement le login,
// puis aiguillage par rôle : staff → /console, membre/parent/jeune → Mon espace.
import { sb, myRoles, landingAfterLogin, getSession } from "./common.js";

const $ = (id) => document.getElementById(id);

// Déjà connecté → on va directement à son espace.
// Tant que la redirection n'est pas faite, le formulaire reste masqué (classe cnx-resuming posée dans le <head> si une
// session est mémorisée) ; s'il n'y a finalement pas de session valable, on le ré-affiche.
const showForm = () => document.documentElement.classList.remove("cnx-resuming");
getSession()
  .then(async (s) => { if (s) location.replace(await landingAfterLogin()); else showForm(); })
  .catch(showForm);
setTimeout(showForm, 8000);   // filet : réseau très lent ou erreur silencieuse → on ne laisse jamais un écran vide

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("login-error"); err.hidden = true;
  const btn = $("login-btn"); btn.disabled = true;
  const { error } = await sb.auth.signInWithPassword({
    email: $("email").value.trim(), password: $("password").value,
  });
  btn.disabled = false;
  if (error) { err.textContent = "Connexion impossible : " + error.message; err.hidden = false; return; }
  location.href = await landingAfterLogin();
});
