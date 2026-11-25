// Page relais : ouverte en pop-up par le bookmarklet depuis Swiss Tennis.
// Elle reçoit les données (postMessage), puis les envoie à la fonction
// d'import (autorisé depuis NOTRE domaine — le CSP de Swiss Tennis bloquait
// l'appel direct).
import { sb } from "./common.js";
const FN = "https://lnrmtwamuaqcubohontn.supabase.co/functions/v1/gz-import";
const AK = "sb_publishable_nsRKXBFgwmDjtmvS3mFc0w_Q4pi_qxK";
const st = document.getElementById("st");
const logOps = async (a, who) => { try { await sb.rpc("ops_log_smart", { p_action: a, p_name: who || null }); } catch (_) {} };

window.addEventListener("message", async (e) => {
  const d = e.data;
  if (!d || d.type !== "gz-data") return;
  const n = d.tournaments ? d.tournaments.length : 0;
  st.textContent = `Import en cours… (${n} tournoi(s))`;
  try {
    const r = await fetch(FN, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: AK },
      body: JSON.stringify({ key: d.key, tournaments: d.tournaments }),
    });
    const j = await r.json();
    if (j.ok) {
      await logOps("gamezone", d.who);
      const total = j.report.reduce((a, x) => a + x.players, 0);
      st.textContent = `✓ Terminé : ${j.report.length} tournoi(s), ${total} inscrits au total. Vous pouvez fermer cette fenêtre et rafraîchir l'onglet GameZone.`;
    } else {
      st.textContent = "Erreur : " + (j.error || JSON.stringify(j));
    }
  } catch (err) {
    st.textContent = "Erreur d'envoi : " + err.message;
  }
});

// Depuis le 25.11.2026, le favori envoie par formulaire et la fonction
// d'import revient ICI avec le résultat dans l'adresse (?ok=1&t=..&p=.. ou ?err=..).
// L'ancien échange par pop-up (ci-dessus) reste pour un favori pas encore remplacé.
const q = new URLSearchParams(location.search);
if (q.has("ok") || q.has("err")) {
  if (q.get("ok") === "1") {
    logOps("gamezone", q.get("who"));
    try { localStorage.setItem("tl-view", "gamezone"); } catch (_) {} // la console rouvre sur GameZone
    st.innerHTML = `✓ Import terminé : <b>${+q.get("t") || 0}</b> tournoi(s), <b>${+q.get("p") || 0}</b> inscrits au total.`
      + `<br><br><a href="/console" class="btn-prod" style="text-decoration:none">Ouvrir GameZone</a>`;
  } else {
    st.textContent = "Erreur : " + q.get("err");
  }
  history.replaceState(null, "", location.pathname); // un rechargement ne re-journalise pas
} else if (window.opener) window.opener.postMessage({ type: "gz-ready" }, "*");
else st.textContent = "Ouvrez cette page via le favori « Importer GameZone », depuis la page Swiss Tennis.";
