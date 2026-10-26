// Le Cercle du Président : demande d'invitation → contact_messages (arrive dans la Messagerie
// de la console, cf. db/59). Entreprise, fonction, téléphone, niveau et Business Spotlight
// sont ajoutés au message : la table n'a pas de colonnes pour eux.
import { sb } from "./common.js";

const $ = (id) => document.getElementById(id);

$("cp-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("cp-error"); err.hidden = true;
  const name = $("cp-name").value.trim(), email = $("cp-email").value.trim();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
    err.textContent = "Merci d'indiquer votre nom et une adresse e-mail valide.";
    err.hidden = false; return;
  }
  const btn = $("cp-btn"); btn.disabled = true; btn.firstChild.textContent = "Envoi… ";

  const lignes = [
    ["Entreprise", $("cp-company").value.trim()],
    ["Fonction", $("cp-role").value.trim()],
    ["Téléphone", $("cp-phone").value.trim()],
    ["Niveau de tennis", $("cp-level").value],
    ["Business Spotlight", $("cp-spotlight").checked ? "intéressé(e)" : ""],
  ].filter(([, v]) => v).map(([k, v]) => `${k} : ${v}`);
  const mot = $("cp-message").value.trim();
  if (mot) lignes.push("", mot);

  const { error } = await sb.from("contact_messages").insert({
    source: "Cercle du Président",
    name, email,
    message: lignes.join("\n") || null,
  });

  btn.disabled = false; btn.firstChild.textContent = "Envoyer ma demande ";
  if (error) { err.textContent = "L'envoi a échoué (" + error.message + "). Appelez-nous au 079 955 06 94."; err.hidden = false; return; }
  $("cp-form").hidden = true;
  $("cp-done").hidden = false;
  $("cp-done").scrollIntoView({ behavior: "smooth", block: "center" });
});

