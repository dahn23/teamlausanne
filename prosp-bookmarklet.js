(async () => {
  try {
    const KEY = "__KEY__", RCV = "__RCV__";
    if (!/mytennis\.ch|swisstennis/.test(location.host)) {
      alert("Va sur la page Classements de mytennis (avec le tableau affiché), puis clique ce favori."); return;
    }
    const licRx = /(\d{2,3}\.\d{2}\.\d{3}\.\d)/;
    const rows = []; const seen = new Set();

    document.querySelectorAll("table tr, [role='row']").forEach((tr) => {
      const tds = [...tr.querySelectorAll("td, [role='cell']")];
      if (tds.length < 4) return;
      const cells = tds.map((td) => (td.textContent || "").replace(/\s+/g, " ").trim());
      const licCell = cells.find((c) => licRx.test(c)); if (!licCell) return;
      const license = licCell.match(licRx)[1];
      if (seen.has(license)) return; seen.add(license);
      const clsCell = cells.find((c) => /^[NR]\d/.test(c)) || "";
      const classification = (clsCell.match(/^([NR]\d)/) || [])[1] || null;
      const position = (clsCell.match(/\((\d+)\)/) || [])[1] || null;
      const valCell = cells.find((c) => /^\d{1,2}[.,]\d+$/.test(c)) || "";
      const value = valCell ? valCell.replace(",", ".") : null;
      const ageCategory = cells.find((c) => /&\s*U|\bU\d|\d+\s*&\s*U/i.test(c)) || null;
      // nom : le lien de la ligne (les noms sont cliquables), sinon 1re cellule alphabétique
      const link = tr.querySelector("td a, [role='cell'] a");
      let name = link ? link.textContent.replace(/\s+/g, " ").trim()
        : (cells.find((c) => /[A-Za-zÀ-ÿ]{3,}/.test(c) && !licRx.test(c) && !/^[NR]\d/.test(c)) || "");
      const parts = name.split(" ").filter(Boolean);
      const last = parts[0] || null, first = parts.slice(1).join(" ") || null;
      rows.push({ license, first, last, classification, value, position, ageCategory });
    });

    if (!rows.length) {
      alert("Aucune ligne de classement trouvée. Assure-toi d'être sur la page Classements avec le tableau visible, puis reclique.");
      return;
    }

    const w = window.open(RCV, "prospimport", "width=460,height=340");
    if (!w) { alert("Autorise les pop-ups, puis reclique le favori."); return; }
    const origin = new URL(RCV).origin;
    const onmsg = (e) => {
      if (e.data && e.data.type === "prosp-ready") {
        w.postMessage({ type: "prosp-data", key: KEY, rows }, origin);
        window.removeEventListener("message", onmsg);
      }
    };
    window.addEventListener("message", onmsg);
    setTimeout(() => window.removeEventListener("message", onmsg), 30000);
  } catch (e) { alert("Erreur bookmarklet : " + e.message); }
})();
