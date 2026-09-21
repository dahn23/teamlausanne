// « Mot de passe oublié » — reset.html (demande du lien) et reset.html?t=<jeton> (nouveau mot de passe).
// Tout passe par la fonction publique password-reset ; le jeton (1 heure, usage unique) arrive par mail.
import { sb, myRoles, landingFor } from "./common.js";

const $ = (id) => document.getElementById(id);
const token = new URLSearchParams(location.search).get("t") || "";

async function call(body) {
  const { data, error } = await sb.functions.invoke("password-reset", { body });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json())?.error || msg; } catch (_e) { /* pas de détail */ }
    return { error: msg };
  }
  return data || {};
}

let email = "";
if (!token) {
  // ---- Étape 1 : demander le lien ----
  $("rs-ask").classList.remove("hidden");
  const pre = new URLSearchParams(location.search).get("e"); if (pre) $("rs-email").value = pre;
  $("rs-ask").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("rs-ask-error"); err.hidden = true;
    const btn = $("rs-ask-btn"); btn.disabled = true; btn.textContent = "Envoi…";
    const r = await call({ action: "request", email: $("rs-email").value.trim() });
    btn.disabled = false; btn.textContent = "Recevoir le lien";
    if (r.error) { err.textContent = r.error; err.hidden = false; return; }
    $("rs-ask").classList.add("hidden");
    $("rs-sent").textContent = r.message || "Si un compte existe pour cette adresse, un mail vient de partir.";
    $("rs-sent").classList.remove("hidden");
  });
} else {
  // ---- Étape 2 : lien reçu par mail ----
  $("rs-wait").classList.remove("hidden");
  const r = await call({ action: "info", token });
  $("rs-wait").classList.add("hidden");
  if (r.error || !r.ok) {
    $("rs-sent").textContent = r.error || "Ce lien n'est pas valable.";
    $("rs-sent").classList.remove("hidden");
    $("rs-ask").classList.remove("hidden");   // on peut tout de suite redemander un lien
    $("rs-ask").addEventListener("submit", (e) => { e.preventDefault(); location.href = "reset.html?e=" + encodeURIComponent($("rs-email").value.trim()); });
  } else {
    email = r.email;
    $("rs-who").textContent = r.email;
    $("rs-new").classList.remove("hidden");
  }
  $("rs-new").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("rs-new-error"); err.hidden = true;
    const p1 = $("rs-pass").value, p2 = $("rs-pass2").value;
    if (p1.length < 8) { err.textContent = "8 caractères minimum."; err.hidden = false; return; }
    if (p1 !== p2) { err.textContent = "Les deux mots de passe ne correspondent pas."; err.hidden = false; return; }
    const btn = $("rs-new-btn"); btn.disabled = true; btn.textContent = "Enregistrement…";
    const res = await call({ action: "reset", token, password: p1 });
    if (res.error || !res.ok) { err.textContent = res.error || "Changement impossible."; err.hidden = false; btn.disabled = false; btn.textContent = "Enregistrer et me connecter"; return; }
    const { error } = await sb.auth.signInWithPassword({ email, password: p1 });
    if (error) { $("rs-new").classList.add("hidden"); $("rs-sent").textContent = "Mot de passe changé. Connecte-toi avec ton e-mail et ton nouveau mot de passe."; $("rs-sent").classList.remove("hidden"); return; }
    location.replace(landingFor(await myRoles()));
  });
}
