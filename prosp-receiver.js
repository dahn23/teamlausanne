// Relais : reçoit les lignes de classement scrappées (postMessage) et les
// envoie à l'edge function prospects-import (depuis NOTRE domaine).
const FN = "https://lnrmtwamuaqcubohontn.supabase.co/functions/v1/prospects-import";
const AK = "sb_publishable_nsRKXBFgwmDjtmvS3mFc0w_Q4pi_qxK";
const st = document.getElementById("st");

window.addEventListener("message", async (e) => {
  const d = e.data;
  if (!d || !d.type) return;
  if (d.type === "prosp-progress") { st.textContent = d.text; return; }
  if (d.type !== "prosp-data") return;
  st.textContent = `Envoi de ${d.rows.length} joueur(s)…`;
  try {
    const r = await fetch(FN, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: AK },
      body: JSON.stringify({ key: d.key, action: "rankings", rows: d.rows }),
    });
    const j = await r.json();
    if (!j.ok) { st.textContent = "Erreur : " + (j.error || JSON.stringify(j)); return; }
    st.textContent = `✓ Terminé : ${j.kept} prospect(s) R7 ou mieux enregistrés (${j.skipped} ignorés sur ${j.total}). Vous pouvez fermer et rafraîchir l'onglet Prospects.`;
  } catch (err) { st.textContent = "Erreur d'envoi : " + err.message; }
});

if (window.opener) window.opener.postMessage({ type: "prosp-ready" }, "*");
else st.textContent = "Ouvrez cette page via le favori, depuis la page Classements de mytennis.";
