// Page d'activation : l'utilisateur arrive via le lien d'invitation (le token
// dans l'URL crée une session), choisit son mot de passe, puis est redirigé.
import { sb } from "./common.js";

const $ = (id) => document.getElementById(id);
let hasSession = false;

function ready() {
  if (hasSession) return;
  hasSession = true;
  $("sp-wait").classList.add("hidden");
  $("sp-form").classList.remove("hidden");
}

sb.auth.onAuthStateChange((_e, session) => { if (session) ready(); });
const { data } = await sb.auth.getSession();
if (data.session) ready();
setTimeout(() => {
  if (!hasSession) $("sp-wait").textContent =
    "Lien invalide ou expiré. Demandez une nouvelle invitation à l'académie.";
}, 3000);

$("sp-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("sp-error"); err.hidden = true;
  const p1 = $("sp-pass").value, p2 = $("sp-pass2").value;
  if (p1.length < 8) { err.textContent = "8 caractères minimum."; err.hidden = false; return; }
  if (p1 !== p2) { err.textContent = "Les mots de passe ne correspondent pas."; err.hidden = false; return; }
  const { error } = await sb.auth.updateUser({ password: p1 });
  if (error) { err.textContent = "Erreur : " + error.message; err.hidden = false; return; }
  location.href = "reservation.html";
});
