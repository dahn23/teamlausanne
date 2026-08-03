// Page relais : ouverte en pop-up par le bookmarklet depuis Swiss Tennis.
// Elle reçoit les données (postMessage), puis les envoie à la fonction
// d'import (autorisé depuis NOTRE domaine — le CSP de Swiss Tennis bloquait
// l'appel direct).
const FN = "https://lnrmtwamuaqcubohontn.supabase.co/functions/v1/gz-import";
const AK = "sb_publishable_nsRKXBFgwmDjtmvS3mFc0w_Q4pi_qxK";
const st = document.getElementById("st");

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
      const total = j.report.reduce((a, x) => a + x.players, 0);
      st.textContent = `✓ Terminé : ${j.report.length} tournoi(s), ${total} inscrits au total. Vous pouvez fermer cette fenêtre et rafraîchir l'onglet GameZone.`;
    } else {
      st.textContent = "Erreur : " + (j.error || JSON.stringify(j));
    }
  } catch (err) {
    st.textContent = "Erreur d'envoi : " + err.message;
  }
});

// Signaler au bookmarklet qu'on est prêt à recevoir
if (window.opener) window.opener.postMessage({ type: "gz-ready" }, "*");
else st.textContent = "Ouvrez cette page via le bookmarklet, depuis la page Swiss Tennis.";
