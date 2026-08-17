// Relais : fournit les ids mytennis des prospects au bookmarklet, reçoit les
// résultats récents, les envoie à l'edge function prospects-import (action recent).
const FN = "https://lnrmtwamuaqcubohontn.supabase.co/functions/v1/prospects-import";
const AK = "sb_publishable_nsRKXBFgwmDjtmvS3mFc0w_Q4pi_qxK";
const st = document.getElementById("st");
let KEY = null;

async function callFn(body) {
  const r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", apikey: AK }, body: JSON.stringify(body) });
  return r.json();
}

window.addEventListener("message", async (e) => {
  const d = e.data;
  if (!d || !d.type) return;

  if (d.type === "presults-start") {
    KEY = d.key;
    st.textContent = "Récupération de la liste des prospects…";
    try {
      const j = await callFn({ key: KEY, action: "prospect_ids" });
      if (!j.ok) { st.textContent = "Erreur : " + (j.error || "?"); return; }
      st.textContent = `${j.ids.length} prospects — analyse des résultats récents…`;
      e.source.postMessage({ type: "presults-ids", ids: j.ids }, "*");
    } catch (err) { st.textContent = "Erreur d'envoi : " + err.message; }
    return;
  }
  if (d.type === "presults-progress") { st.textContent = d.text; return; }

  if (d.type === "presults-data") {
    st.textContent = "Enregistrement des résultats…";
    try {
      const j = await callFn({ key: KEY || d.key, action: "recent", rows: d.rows });
      if (!j.ok) { st.textContent = "Erreur : " + (j.error || JSON.stringify(j)); return; }
      let msg = `✓ Terminé : ${j.stored} match(s) récents enregistrés pour ${j.matched} prospect(s), dont 🔥 ${j.upsets} exploit(s). Rafraîchis l'onglet Prospects.`;
      const g = d.diag;
      if (g && j.stored === 0) {
        msg += `\n\n— Diagnostic —\nJetons : ${g.jwts} · valide : ${g.tokenOk ? "oui" : "NON"}\nRésultats parcourus : ${g.scanned ?? 0}`;
        if (g.err) msg += `\nErreur API : ${g.err}`;
      }
      st.textContent = msg;
    } catch (err) { st.textContent = "Erreur d'envoi : " + err.message; }
    return;
  }
});

if (window.opener) window.opener.postMessage({ type: "presults-ready" }, "*");
else st.textContent = "Ouvrez cette page via le favori, depuis mytennis.";
