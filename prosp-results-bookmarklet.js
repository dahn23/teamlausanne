(async () => {
  try {
    const KEY = "__KEY__", RCV = "__RCV__";
    const HASURA = "https://hasura.swisstennis.ch/v1/graphql";
    const DAYS = 21;
    if (!/mytennis\.ch|swisstennis/.test(location.host)) {
      alert("Ouvre mytennis.ch (connecté), puis clique ce favori."); return;
    }
    const jwts = (() => {
      const out = new Set(); const rx = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{10,}/g;
      for (const s of [localStorage, sessionStorage]) {
        for (let i = 0; i < s.length; i++) { const v = s.getItem(s.key(i)); if (v) (v.match(rx) || []).forEach((t) => out.add(t)); }
      }
      return [...out];
    })();
    const gql = async (q, vars, tok) => {
      const r = await fetch(HASURA, { method: "POST", headers: { "Content-Type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) }, body: JSON.stringify({ query: q, variables: vars }) });
      return r.json();
    };
    const Q = "query($where:AllSingleResults_bool_exp,$limit:Int,$offset:Int){results:AllSingleResults(where:$where,order_by:{date:desc},limit:$limit,offset:$offset){playerPersonId date tournamentName adversaryPersonId adversaryFirstname adversaryLastname playerSet1WonGames adversarySet1WonGames playerSet2WonGames adversarySet2WonGames playerSet3WonGames adversarySet3WonGames playerSet4WonGames adversarySet4WonGames playerSet5WonGames adversarySet5WonGames playerWinnerCode round:Asr_Round_i encounterId:Asr_Id_Item_l source adversary{classification classificationValue}}}";
    const from = (() => { const d = new Date(); d.setDate(d.getDate() - DAYS); return d.toISOString().slice(0, 10); })();
    const scoreOf = (m) => { const p = []; for (let s = 1; s <= 5; s++) { const a = m["playerSet" + s + "WonGames"], b = m["adversarySet" + s + "WonGames"]; if (a == null || b == null || a < 0 || b < 0 || (a === 0 && b === 0)) continue; p.push(a + "-" + b); } return p.join(" "); };
    const wonOf = (m) => { const wc = String(m.playerWinnerCode || "").toUpperCase(); if (wc === "S" || wc === "W") return true; if (wc === "N" || wc === "L") return false; let pw = 0, aw = 0; for (let s = 1; s <= 5; s++) { const a = m["playerSet" + s + "WonGames"], b = m["adversarySet" + s + "WonGames"]; if (a != null && b != null) { if (a > b) pw++; else if (b > a) aw++; } } return pw > aw ? true : (aw > pw ? false : null); };

    // jeton valide (probe)
    let token = null;
    for (const t of jwts) { try { const j = await gql(Q, { where: { date: { _gte: from }, playerPersonId: { _in: [1] } }, limit: 1, offset: 0 }, t); if (j && j.data && j.data.results) { token = t; break; } } catch (e) { /* suivant */ } }
    const diag = { jwts: jwts.length, tokenOk: !!token, scanned: 0, err: null };

    const w = window.open(RCV, "presultsimport", "width=480,height=360");
    if (!w) { alert("Autorise les pop-ups pour mytennis, puis reclique."); return; }
    const origin = new URL(RCV).origin; const post = (m) => w.postMessage(m, origin);

    const onmsg = async (e) => {
      const d = e.data; if (!d || !d.type) return;
      if (d.type === "presults-ready") { post({ type: "presults-start", key: KEY }); return; }
      if (d.type === "presults-ids") {
        window.removeEventListener("message", onmsg);
        if (!token) { post({ type: "presults-data", key: KEY, rows: [], diag }); return; }
        const ids = d.ids || []; const out = []; const B = 400;
        for (let b = 0; b < ids.length; b += B) {
          const batch = ids.slice(b, b + B);
          let offset = 0, more = true, guard = 0;
          while (more && guard++ < 20) {
            post({ type: "presults-progress", text: `Analyse ${Math.min(b + B, ids.length)}/${ids.length} prospects — ${out.length} matchs récents…` });
            let j; try { j = await gql(Q, { where: { date: { _gte: from }, playerPersonId: { _in: batch } }, limit: 500, offset }, token); } catch (err) { diag.err = String(err); more = false; break; }
            if (j.errors && j.errors[0]) { diag.err = j.errors[0].message; more = false; break; }
            const list = (j.data && j.data.results) || [];
            diag.scanned += list.length;
            for (const o of list) out.push({
              playerPersonId: o.playerPersonId, date: o.date, tournamentName: o.tournamentName,
              opponentFirst: o.adversaryFirstname, opponentLast: o.adversaryLastname, opponentId: o.adversaryPersonId,
              opponentClassification: o.adversary && o.adversary.classification, opponentValue: o.adversary && o.adversary.classificationValue,
              score: scoreOf(o), won: wonOf(o), winnerCode: o.playerWinnerCode, round: o.round, encounterId: o.encounterId, source: o.source,
            });
            if (list.length < 500) more = false; else offset += 500;
          }
        }
        post({ type: "presults-data", key: KEY, rows: out, diag });
      }
    };
    window.addEventListener("message", onmsg);
    setTimeout(() => window.removeEventListener("message", onmsg), 900000);
  } catch (e) { alert("Erreur bookmarklet : " + e.message); }
})();
