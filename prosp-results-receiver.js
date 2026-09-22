// Relais : fournit les ids mytennis des prospects au bookmarklet, reçoit les
// résultats récents, les envoie à l'edge function prospects-import (action recent).
import { sb } from "./common.js";
const FN = "https://lnrmtwamuaqcubohontn.supabase.co/functions/v1/prospects-import";
const AK = "sb_publishable_nsRKXBFgwmDjtmvS3mFc0w_Q4pi_qxK";
const st = document.getElementById("st");
const logOps = async (a, who) => { try { await sb.rpc("ops_log_smart", { p_action: a, p_name: who || null }); } catch (_) {} };
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
    // Envoi par PAQUETS : depuis que le favori couvre les 4500 prospects, un envoi unique dépassait les 150 s
    // autorisées par requête (22.09.2026 : « IDLE_TIMEOUT » alors que tout était enregistré).
    const rows = d.rows || [], B = 600, N = Math.max(1, Math.ceil(rows.length / B));
    const tot = { stored: 0, upsets: 0, matched: new Set() };
    try {
      for (let i = 0; i < rows.length; i += B) {
        st.textContent = `Enregistrement des résultats… paquet ${Math.floor(i / B) + 1}/${N} (${Math.min(i + B, rows.length)}/${rows.length} matchs)`;
        const j = await callFn({ key: KEY || d.key, action: "recent", rows: rows.slice(i, i + B) });
        if (!j.ok) { st.textContent = `Erreur au paquet ${Math.floor(i / B) + 1}/${N} : ` + (j.error || JSON.stringify(j)) + ` — ${tot.stored} match(s) déjà enregistrés.`; return; }
        tot.stored += j.stored || 0; tot.upsets += j.upsets || 0;
        for (const l of j.licenses || []) tot.matched.add(l);
      }
      if (!rows.length) { await callFn({ key: KEY || d.key, action: "recent", rows: [] }); }
      await logOps("scan", d.who);
      let msg = `✓ Terminé : ${tot.stored} match(s) récents enregistrés pour ${tot.matched.size} prospect(s), dont 🔥 ${tot.upsets} exploit(s). Rafraîchis l'onglet Prospects.`;
      const g = d.diag;
      if (g && tot.stored === 0) {
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
