(async () => {
  try {
    const KEY = "__KEY__", RCV = "__RCV__";
    if (!/mytennis\.ch|swisstennis/.test(location.host)) {
      alert("Ouvre la fiche « Voir la licence » d'un joueur sur le portail des licences, puis clique ce favori."); return;
    }
    const license = (document.body.innerText.match(/\b(\d{2,3}\.\d{2}\.\d{3}\.\d)\b/) || [])[1];
    if (!license) { alert("Aucun n° de licence trouvé. Ouvre la fiche « Voir la licence » d'un joueur."); return; }

    const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
    const labels = [...document.querySelectorAll("label")];
    const byLabel = (names) => {
      for (const nm of names) {
        const lb = labels.find((l) => norm(l.textContent) === nm.toLowerCase());
        if (!lb) continue;
        let inp = null;
        if (lb.htmlFor) inp = document.getElementById(lb.htmlFor);
        if (!inp) inp = lb.querySelector("input,textarea,select");
        if (!inp && lb.parentElement) inp = lb.parentElement.querySelector("input,textarea,select");
        if (!inp) { let n = lb.nextElementSibling, g = 0; while (n && !inp && g++ < 3) { inp = (n.matches && n.matches("input,textarea")) ? n : (n.querySelector && n.querySelector("input,textarea")); n = n.nextElementSibling; } }
        if (inp && inp.value != null && inp.value.trim()) return inp.value.trim();
      }
      return null;
    };
    const email = byLabel(["Email", "E-mail"]);
    const phone = byLabel(["Téléphone", "Telephone", "Mobile", "Natel"]);
    const address = byLabel(["Rue", "Adresse"]);
    const postal_code = byLabel(["NPA"]);
    const city = byLabel(["Ville", "Lieu", "Localité"]);
    const found = [email, phone, address, postal_code, city].filter(Boolean).length;
    if (!found) { alert("Licence " + license + " trouvée, mais aucun champ (email/tél/adresse) lu — la page a peut-être changé. Signale-le."); return; }

    const w = window.open(RCV, "pcontact", "width=460,height=320");
    if (!w) { alert("Autorise les pop-ups, puis reclique."); return; }
    const origin = new URL(RCV).origin;
    const onmsg = (e) => {
      if (e.data && e.data.type === "pcontact-ready") {
        w.postMessage({ type: "pcontact-data", key: KEY, license, email, phone, address, postal_code, city }, origin);
        window.removeEventListener("message", onmsg);
      }
    };
    window.addEventListener("message", onmsg);
    setTimeout(() => window.removeEventListener("message", onmsg), 20000);
  } catch (e) { alert("Erreur : " + e.message); }
})();
