// Activation d'un accès « Mon espace » depuis le mail d'invitation : activer.html?t=<jeton>.
// Le jeton (30 jours, usage unique) est vérifié par la fonction portal-activate ; la famille choisit son mot de
// passe, puis la page la connecte et ouvre Mon espace.
import { sb, myRoles, landingFor } from "./common.js";

const $ = (id) => document.getElementById(id);
const token = new URLSearchParams(location.search).get("t") || "";

async function call(body) {
  const { data, error } = await sb.functions.invoke("portal-activate", { body });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json())?.error || msg; } catch (_e) { /* pas de détail */ }
    return { error: msg };
  }
  return data || {};
}
function fail(msg) {
  $("ac-wait").textContent = msg;
  $("ac-wait").classList.remove("hidden");
  $("ac-form").classList.add("hidden");
  $("ac-login").classList.remove("hidden");
}

let email = "";
(async () => {
  if (token === "exemple") return fail("Ceci est le lien d'exemple du mail de test : il ne fait rien. Les familles recevront un vrai lien personnel.");
  const r = await call({ action: "info", token });
  if (r.error || !r.ok) return fail(r.error || "Ce lien n'est pas valable.");
  email = r.email;
  $("ac-email").textContent = r.email;
  $("ac-hello").innerHTML = r.prenoms
    ? `Bienvenue ! Cet espace te permet de suivre les cours de <b></b>.`
    : "Bienvenue !";
  const b = $("ac-hello").querySelector("b"); if (b) b.textContent = r.prenoms;   // textContent : jamais de HTML venu du serveur
  $("ac-wait").classList.add("hidden");
  $("ac-form").classList.remove("hidden");
})();

$("ac-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("ac-error"); err.hidden = true;
  const p1 = $("ac-pass").value, p2 = $("ac-pass2").value;
  if (p1.length < 8) { err.textContent = "8 caractères minimum."; err.hidden = false; return; }
  if (p1 !== p2) { err.textContent = "Les deux mots de passe ne correspondent pas."; err.hidden = false; return; }
  const btn = $("ac-btn"); btn.disabled = true; btn.textContent = "Activation…";
  const r = await call({ action: "activate", token, password: p1 });
  if (r.error || !r.ok) { err.textContent = r.error || "Activation impossible."; err.hidden = false; btn.disabled = false; btn.textContent = "Activer Mon espace"; return; }
  const { error } = await sb.auth.signInWithPassword({ email, password: p1 });
  if (error) return fail("Ton accès est activé. Connecte-toi avec ton e-mail et ton nouveau mot de passe.");
  location.href = landingFor(await myRoles());
});
