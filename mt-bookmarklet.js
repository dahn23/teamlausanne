(async () => {
  try {
    const KEY = "__KEY__", RCV = "__RCV__";
    const HASURA = "https://hasura.swisstennis.ch/v1/graphql";
    const SEARCH = "https://high-scalability.microservices.swisstennis.ch/player-autocomplete-query";
    if (!/mytennis\.ch|swisstennis/.test(location.host)) {
      alert("Ouvre d'abord mytennis.ch (connecté), puis clique ce favori."); return;
    }

    // 1) Récupérer TOUT jeton JWT présent dans le stockage de la session mytennis
    //    (regex : attrape les JWT même imbriqués/encodés dans du JSON).
    const jwts = (() => {
      const out = new Set();
      const rx = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{10,}/g;
      for (const store of [localStorage, sessionStorage]) {
        for (let i = 0; i < store.length; i++) {
          const v = store.getItem(store.key(i)); if (!v) continue;
          (v.match(rx) || []).forEach((t) => out.add(t));
        }
      }
      return [...out];
    })();

    const gql = async (query, variables, token) => {
      const r = await fetch(HASURA, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
        body: JSON.stringify({ query, variables }),
      });
      return r.json();
    };
    const Q_PERSON = "query($l:String!){person(where:{lizenz_nehmer:{licenceNumber:{_eq:$l}}}){id firstname lastname gender lizenz_nehmer{classification ranking}}}";
    const Q_SINGLES = "query($id:Int!){results:AllSingleResults(where:{personId:{_eq:$id}},order_by:{date:desc},limit:500){date tournamentName adversaryPersonId adversaryFirstname adversaryLastname playerSet1WonGames adversarySet1WonGames playerSet2WonGames adversarySet2WonGames playerSet3WonGames adversarySet3WonGames playerSet4WonGames adversarySet4WonGames playerSet5WonGames adversarySet5WonGames playerWinnerCode round:Asr_Round_i encounterId:Asr_Id_Item_l source adversary{classification ranking}}}";

    // trouve un jeton qui a accès à la table person ; sinon null
    let token = null, tokenTried = false;
    const findToken = async (lic) => {
      for (const t of jwts) {
        try { const j = await gql(Q_PERSON, { l: lic }, t); if (j && j.data && j.data.person) return t; } catch (e) { /* suivant */ }
      }
      return null;
    };
    // fallback public : recherche par nom -> id + classement (match sur la licence)
    const searchByName = async (name, lic) => {
      try {
        const r = await fetch(SEARCH, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: name, offset: 0, limit: 20 }) });
        const j = await r.json();
        const hits = (j && j.hits && j.hits.hits) || [];
        const hit = hits.map((h) => h._source).find((s) => s && s.licenseNr === lic);
        return hit ? { id: hit.id, classification: hit.classification } : null;
      } catch (e) { return null; }
    };

    const scoreOf = (m) => {
      const parts = [];
      for (let s = 1; s <= 5; s++) {
        const p = m["playerSet" + s + "WonGames"], a = m["adversarySet" + s + "WonGames"];
        if (p != null && a != null && !(p === 0 && a === 0)) parts.push(p + "-" + a);
      }
      return parts.join(" ");
    };
    const wonOf = (m) => {
      const wc = m.playerWinnerCode;
      if (wc === 1 || wc === "1") return true;
      if (wc === 2 || wc === "2") return false;
      let pw = 0, aw = 0;
      for (let s = 1; s <= 5; s++) { const p = m["playerSet" + s + "WonGames"], a = m["adversarySet" + s + "WonGames"]; if (p != null && a != null) { if (p > a) pw++; else if (a > p) aw++; } }
      return pw > aw ? true : (aw > pw ? false : null);
    };

    // 2) Ouvrir le relais (notre domaine) et le piloter
    const w = window.open(RCV, "mtimport", "width=460,height=360");
    if (!w) { alert("Autorise les pop-ups pour mytennis.ch, puis reclique le favori."); return; }
    const origin = new URL(RCV).origin;
    const post = (m) => w.postMessage(m, origin);

    const diag = { jwts: jwts.length, tokenOk: false, first: null };
    const onmsg = async (e) => {
      const d = e.data; if (!d || !d.type) return;
      if (d.type === "mt-ready") { post({ type: "mt-start", key: KEY }); return; }
      if (d.type === "mt-players") {
        const players = d.players || [];
        const out = [];
        for (let i = 0; i < players.length; i++) {
          const pl = players[i];
          post({ type: "mt-progress", text: `Joueur ${i + 1}/${players.length} : ${pl.name}…` });
          const dg = (i === 0) ? { name: pl.name, license: pl.license } : null;
          try {
            let mtId = null, classification = null, via = null;
            if (!tokenTried) { token = await findToken(pl.license); tokenTried = true; diag.tokenOk = !!token; }
            if (token) {
              const pj = await gql(Q_PERSON, { l: pl.license }, token);
              if (dg) dg.personErr = pj.errors && pj.errors[0] && pj.errors[0].message;
              const person = pj.data && pj.data.person && pj.data.person[0];
              if (person) { mtId = person.id; via = "token"; const ln = person.lizenz_nehmer; classification = (Array.isArray(ln) ? ln[0] : ln)?.classification || null; }
            }
            if (!mtId) { const s = await searchByName(pl.name, pl.license); if (s) { mtId = s.id; classification = s.classification; via = "search"; } }
            if (dg) { dg.via = via; dg.mtId = mtId; }
            if (!mtId) { out.push({ license: pl.license, mt_person_id: null, matches: [] }); continue; }

            let matches = [];
            if (token) {
              const sj = await gql(Q_SINGLES, { id: mtId }, token);
              if (dg) { dg.singlesErr = sj.errors && sj.errors[0] && sj.errors[0].message; }
              const res = (sj.data && sj.data.results) || [];
              if (dg) dg.resultsCount = res.length;
              matches = res.map((m) => ({
                encounterId: m.encounterId, date: m.date, isDouble: false, tournamentName: m.tournamentName,
                opponentFirst: m.adversaryFirstname, opponentLast: m.adversaryLastname, opponentId: m.adversaryPersonId,
                score: scoreOf(m), winnerCode: m.playerWinnerCode, won: wonOf(m), round: m.round,
                opponentRanking: m.adversary && m.adversary.ranking, opponentClassification: m.adversary && m.adversary.classification,
                source: m.source, raw: m,
              }));
            } else if (dg) { dg.singlesErr = "pas de jeton -> resultats non interrogeables"; }
            if (dg) diag.first = dg;
            out.push({ license: pl.license, mt_person_id: mtId, classification, matches });
          } catch (err) { if (dg) { dg.exception = String(err); diag.first = dg; } out.push({ license: pl.license, error: String(err), matches: [] }); }
        }
        post({ type: "mt-data", key: KEY, players: out, diag });
        window.removeEventListener("message", onmsg);
      }
    };
    window.addEventListener("message", onmsg);
    setTimeout(() => window.removeEventListener("message", onmsg), 300000);
  } catch (e) { alert("Erreur bookmarklet : " + e.message); }
})();
