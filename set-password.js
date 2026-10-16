// Page d'activation : la personne arrive par le lien d'invitation, choisit son
// mot de passe, puis repart vers l'écran qui correspond à son rôle.
//
// ⚠️ POURQUOI LE JETON EST DANS LE FRAGMENT (#) — 16.10.2026
//
// Un lien d'activation est à usage unique : la première requête le consomme.
// Or WhatsApp, Messenger, Outlook et les autres VISITENT le lien qu'on leur
// colle pour en fabriquer l'aperçu. Leur robot brûlait donc le jeton avant
// que la personne n'ait tapé dessus, et elle tombait sur « Lien invalide ou
// expiré ». Constaté en base : deux sessions « WhatsApp/2.23.20.0 » sur le
// compte d'Augustin Tarouat, dont aucune par lui.
//
// Le jeton arrive maintenant après le #. Un fragment n'est JAMAIS transmis au
// serveur : le robot reçoit une page vide et n'a rien à consommer. Seul un
// vrai navigateur, qui exécute ce fichier, s'en sert — et le lien reste donc
// valable jusqu'à ce que la personne l'ouvre vraiment.
import { sb, myRoles, landingFor } from "./common.js";

const $ = (id) => document.getElementById(id);
let pret = false;

function ready() {
  if (pret) return;
  pret = true;
  $("sp-wait").classList.add("hidden");
  $("sp-form").classList.remove("hidden");
}

function echec(msg) {
  if (pret) return;
  $("sp-wait").textContent = msg;
}

// Le fragment, lu puis effacé tout de suite : inutile de laisser un jeton
// dans la barre d'adresse et dans l'historique du navigateur.
const frag = new URLSearchParams((location.hash || "").replace(/^#/, ""));
const th = frag.get("th");
const type = frag.get("t") || "invite";
if (th) history.replaceState(null, "", location.pathname + location.search);

sb.auth.onAuthStateChange((_e, session) => { if (session) ready(); });

if (th) {
  // Lien nouvelle génération : c'est ici, et nulle part ailleurs, que le
  // jeton est échangé contre une session.
  const { error } = await sb.auth.verifyOtp({ token_hash: th, type });
  if (error) {
    echec(/expired|invalid/i.test(error.message || "")
      ? "Ce lien a expiré. Demandez-en un nouveau à l'académie."
      : "Lien invalide : " + error.message);
  } else {
    ready();
  }
} else {
  // Anciens liens (jeton déjà échangé par Supabase) et personne déjà connectée.
  const { data } = await sb.auth.getSession();
  if (data.session) ready();
  setTimeout(() => echec(
    "Lien invalide ou expiré. Demandez une nouvelle invitation à l'académie."), 3000);
}

$("sp-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("sp-error"); err.hidden = true;
  const p1 = $("sp-pass").value, p2 = $("sp-pass2").value;
  if (p1.length < 8) { err.textContent = "8 caractères minimum."; err.hidden = false; return; }
  if (p1 !== p2) { err.textContent = "Les mots de passe ne correspondent pas."; err.hidden = false; return; }
  const { error } = await sb.auth.updateUser({ password: p1 });
  if (error) { err.textContent = "Erreur : " + error.message; err.hidden = false; return; }
  // Selon le rôle : un coach/prof invité arrive sur la console, un membre sur Mon espace.
  location.href = landingFor(await myRoles());
});
