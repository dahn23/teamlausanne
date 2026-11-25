(async () => {
  try {
    const KEY = "__KEY__", RCV = "__RCV__", WHO = "__WHO__";
    const FN = "https://lnrmtwamuaqcubohontn.supabase.co/functions/v1/gz-import";
    const base = "/advantage/servlet/";
    // Bandeau d'avancement : sur téléphone, sans lui, rien ne bouge pendant la lecture.
    const info = (t) => {
      let b = document.getElementById("gz-bm-info");
      if (!t) { if (b) b.remove(); return; }
      if (!b) {
        b = document.createElement("div"); b.id = "gz-bm-info";
        b.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#123cc4;color:#fff;font:600 16px/1.4 sans-serif;padding:14px 16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.3)";
        document.body.appendChild(b);
      }
      b.textContent = "GameZone — " + t;
    };
    info("lecture de la liste des tournois…");
    const g = async (u) => await (await fetch(u, { credentials: "include" })).text();
    if (!/swisstennis/.test(location.host)) { info(""); alert("Ouvre d'abord ta liste de tournois Swiss Tennis (connecté), puis clique ce favori."); return; }
    let listH = await g(base + "MyTournamentList?lang=F");
    if (/Login Zone/i.test(listH)) { info(""); alert("Tu n'es pas connecté à Swiss Tennis. Connecte-toi puis réessaie."); return; }
    // Basculer sur le compte « Team Lausanne » si un autre est actif
    try {
      const rd = new DOMParser().parseFromString(listH, "text/html").querySelector("[data-realms]");
      if (rd) {
        const names = [...(rd.getAttribute("data-realms") || "").matchAll(/:([^,\]]+?)\s*\(\d+\)/g)].map((m) => m[1].trim());
        const idx = names.findIndex((n) => /team lausanne/i.test(n));
        const sel = parseInt(rd.getAttribute("selected-realm-index") || "-1", 10);
        if (idx >= 0 && idx !== sel) {
          await fetch(base + "SwitchRealm?Lang=F", { method: "POST", credentials: "include", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "Lang=F&realmIndex=" + idx });
          listH = await g(base + "MyTournamentList?lang=F");
        }
      }
    } catch (e) { /* pas de bascule possible */ }
    const ld = new DOMParser().parseFromString(listH, "text/html");
    // On ne re-scanne que les tournois des 2 dernières semaines + à venir :
    // un tournoi plus ancien est figé (inscriptions closes, tableaux faits),
    // le re-scanner ne sert à rien et coûte 2 requêtes. Gros gain de temps.
    const BACK_DAYS = 14;
    const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); cutoff.setDate(cutoff.getDate() - BACK_DAYS);
    const maxDate = (s) => {
      const ms = [...String(s).matchAll(/(\d{2})\.(\d{2})\.(\d{4})/g)];
      if (!ms.length) return null;
      return ms.map((m) => new Date(+m[3], +m[2] - 1, +m[1])).sort((a, b) => b - a)[0];
    };
    const seen = new Set(); const ids = []; let skipped = 0;
    for (const a of ld.querySelectorAll('a[href*="tournament=Id"]')) {
      const id = (a.getAttribute("href").match(/Id(\d+)/) || [])[1];
      if (!id || seen.has(id)) continue; seen.add(id);
      const tr = a.closest("tr");
      const dt = tr ? maxDate(tr.textContent) : null;      // date la plus récente de la ligne
      if (dt && dt < cutoff) { skipped++; continue; }        // tournoi passé et figé → on saute
      ids.push(id);
    }
    if (!ids.length) { info(""); alert("Aucun tournoi récent ou à venir à mettre à jour" + (skipped ? " (" + skipped + " tournoi(s) passé(s) ignoré(s))." : ".")); return; }
    const T = [];
    for (const id of ids) {
      info("tournoi " + (T.length + 1) + " sur " + ids.length + "…");
      const dH = await g(base + "ProtectedDisplayTournament?tournament=Id" + id + "&lang=F");
      const d = new DOMParser().parseFromString(dH, "text/html");
      const tds = [...d.querySelectorAll("td")];
      const val = (l) => { const t = tds.find((x) => x.textContent.trim() === l); return t && t.nextElementSibling ? t.nextElementSibling.textContent.trim() : ""; };
      const titleEl = d.querySelector("td.textbold");
      const title = titleEl ? titleEl.textContent : ("Tournoi " + id);
      const name = title.split(",")[0].replace(/\s*\(\d+\)\s*$/, "").trim();
      const stEl = [...d.querySelectorAll("td.textbold")].find((x) => x.textContent.trim() === "Statut");
      let status = "";
      if (stEl) { const nr = stEl.closest("tr").nextElementSibling; status = nr && nr.querySelector("td") ? nr.querySelector("td").textContent.trim() : ""; }
      const eps = [];
      const sub = [...d.querySelectorAll("td.subtitle")].find((x) => x.textContent.trim() === "Epreuves");
      if (sub) {
        let tr = sub.closest("tr").nextElementSibling;
        while (tr) {
          const c = tr.querySelectorAll(":scope > td");
          if (c.length >= 3) {
            const nm = c[0].textContent.replace(/\s+/g, " ").trim();
            if (!nm) break;
            eps.push({ name: nm, count: parseInt(c[1].textContent) || 0, status: c[2].textContent.replace(/\s+/g, " ").trim() });
          } else break;
          tr = tr.nextElementSibling;
        }
      }
      let b64 = null;
      try {
        const buf = await (await fetch(base + "PlayerList.xls?tournament=Id" + id + "&lang=F", { credentials: "include" })).arrayBuffer();
        const b = new Uint8Array(buf);
        let s = "";
        for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
        b64 = btoa(s);
      } catch (e) { /* xls indisponible avant tirage */ }
      T.push({ swiss_id: "Id" + id, name, start_date: val("Débute le"), deadline: val("Date limite d'inscription"), draw_date: val("Tirage au sort"), status, epreuves: eps, players_b64: b64 });
    }
    // Envoi par FORMULAIRE dans le même onglet (25.11.2026). L'ancienne petite
    // fenêtre relais était bloquée sur téléphone (pop-up ouvert trop longtemps
    // après le clic). Swiss Tennis interdit fetch() vers nous mais pas les
    // formulaires ; la fonction répond en renvoyant sur gz-receiver.html.
    info("Envoi à Team Lausanne…");
    const f = document.createElement("form");
    f.method = "POST"; f.action = FN; f.acceptCharset = "UTF-8"; f.style.display = "none";
    const champ = (n, v) => { const i = document.createElement("textarea"); i.name = n; i.value = v; f.appendChild(i); };
    champ("payload", JSON.stringify({ key: KEY, who: WHO, tournaments: T }));
    champ("ret", RCV);
    document.body.appendChild(f);
    f.submit();
  } catch (e) { info(""); alert("Erreur bookmarklet : " + e.message); }
})();
