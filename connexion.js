// Page de connexion épurée (app.teamlausanne.ch) — uniquement le login,
// puis aiguillage par rôle : staff → /console, membre/parent/jeune → Mon espace.
import { sb, myRoles, landingFor, getSession } from "./common.js";

const $ = (id) => document.getElementById(id);

// Déjà connecté → on va directement à son espace.
getSession().then(async (s) => { if (s) location.href = landingFor(await myRoles()); });

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("login-error"); err.hidden = true;
  const btn = $("login-btn"); btn.disabled = true;
  const { error } = await sb.auth.signInWithPassword({
    email: $("email").value.trim(), password: $("password").value,
  });
  btn.disabled = false;
  if (error) { err.textContent = "Connexion impossible : " + error.message; err.hidden = false; return; }
  location.href = landingFor(await myRoles());
});
