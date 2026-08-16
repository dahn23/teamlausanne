// Page relais : ouverte par le bookmarklet depuis mytennis. Elle fournit la
// liste des licences du répertoire au bookmarklet, puis reçoit les matchs
// (postMessage) et les envoie à l'edge function mt-import (autorisé depuis
// NOTRE domaine — la CSP de mytennis bloque l'appel direct).
const FN = "https://lnrmtwamuaqcubohontn.supabase.co/functions/v1/mt-import";
const AK = "sb_publishable_nsRKXBFgwmDjtmvS3mFc0w_Q4pi_qxK";
const st = document.getElementById("st");
let KEY = null;

async function callFn(body) {
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: AK },
    body: JSON.stringify(body),
  });
  return r.json();
}

window.addEventListener("message", async (e) => {
  const d = e.data;
  if (!d || !d.type) return;

  if (d.type === "mt-start") {
    KEY = d.key;
    st.textContent = "Récupération de la liste des joueurs…";
    try {
      const j = await callFn({ key: KEY, action: "licenses" });
      if (!j.ok) { st.textContent = "Erreur : " + (j.error || "?"); return; }
      st.textContent = `${j.players.length} joueur(s) à interroger sur mytennis…`;
      e.source.postMessage({ type: "mt-players", players: j.players }, "*");
    } catch (err) { st.textContent = "Erreur d'envoi : " + err.message; }
    return;
  }

  if (d.type === "mt-progress") { st.textContent = d.text; return; }

  if (d.type === "mt-data") {
    st.textContent = "Enregistrement des matchs…";
    try {
      const j = await callFn({ key: KEY || d.key, action: "import", players: d.players });
      if (!j.ok) { st.textContent = "Erreur : " + (j.error || JSON.stringify(j)); return; }
      const totalMatches = j.report.reduce((a, x) => a + (x.matches || 0), 0);
      const matched = j.report.filter((x) => x.matched).length;
      st.textContent = `✓ Terminé : ${matched} joueur(s) reliés, ${totalMatches} match(s) enregistré(s). Vous pouvez fermer cette fenêtre et rafraîchir la fiche.`;
    } catch (err) { st.textContent = "Erreur d'envoi : " + err.message; }
    return;
  }
});

// Signaler au bookmarklet qu'on est prêt
if (window.opener) window.opener.postMessage({ type: "mt-ready" }, "*");
else st.textContent = "Ouvrez cette page via le favori, depuis mytennis.";
