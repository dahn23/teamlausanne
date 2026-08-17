// Relais : reçoit les coordonnées scrappées sur le portail des licences et les
// enregistre sur le prospect (par n° de licence) via prospects-import.
const FN = "https://lnrmtwamuaqcubohontn.supabase.co/functions/v1/prospects-import";
const AK = "sb_publishable_nsRKXBFgwmDjtmvS3mFc0w_Q4pi_qxK";
const st = document.getElementById("st");

window.addEventListener("message", async (e) => {
  const d = e.data;
  if (!d || d.type !== "pcontact-data") return;
  st.textContent = "Enregistrement…";
  try {
    const r = await fetch(FN, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: AK },
      body: JSON.stringify({ key: d.key, action: "contact", license: d.license, email: d.email, phone: d.phone, address: d.address, postal_code: d.postal_code, city: d.city }),
    });
    const j = await r.json();
    if (!j.ok) { st.textContent = "Erreur : " + (j.error || JSON.stringify(j)); return; }
    if (!j.updated) { st.textContent = `Licence ${d.license} : pas de prospect correspondant dans la base (le joueur n'est peut-être pas dans les R7+ importés).`; return; }
    st.textContent = `✓ Coordonnées enregistrées pour la licence ${d.license}. Fermez et rafraîchissez la fiche.`;
  } catch (err) { st.textContent = "Erreur d'envoi : " + err.message; }
});

if (window.opener) window.opener.postMessage({ type: "pcontact-ready" }, "*");
else st.textContent = "Ouvrez cette page via le favori, depuis le portail des licences.";
