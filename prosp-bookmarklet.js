(async () => {
  try {
    const KEY = "__KEY__", RCV = "__RCV__";
    const HASURA = "https://hasura.swisstennis.ch/v1/graphql";
    if (!/mytennis\.ch|swisstennis/.test(location.host)) {
      alert("Ouvre mytennis.ch (connecté), puis clique ce favori."); return;
    }
    // jetons de la session
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
    const Q = "query($where:lizenz_nehmer_bool_exp,$orderBy:[lizenz_nehmer_order_by!],$limit:Int,$offset:Int){lizenz_nehmer(where:$where,order_by:$orderBy,limit:$limit,offset:$offset){licenceNumber ranking classification classificationValue ageCategoryRedundant person{id firstname lastname gender birthdate canton} clubs{club{name}}}}";
    // moins de 19 ans : né après (aujourd'hui − 19 ans)
    const minBirth = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 19); return d.toISOString().slice(0, 10); })();
    const where = { kontingent: { _eq: 1 }, currentLicenceStatusId: { _lt: 3 }, person: { birthdate: { _gte: minBirth } } };
    const orderBy = [{ classificationValue: "desc" }, { ranking: "asc" }];
    const isR7 = (c) => /^(N[1-4]|R[1-7])$/.test(String(c || "").toUpperCase());

    // trouver un jeton valide
    let token = null;
    for (const t of jwts) { try { const j = await gql(Q, { where, orderBy, limit: 1, offset: 0 }, t); if (j && j.data && j.data.lizenz_nehmer) { token = t; break; } } catch (e) { /* suivant */ } }
    if (!token) { alert("Jeton mytennis introuvable ou invalide. Assure-toi d'être connecté sur mytennis, puis réessaie."); return; }

    const w = window.open(RCV, "prospimport", "width=460,height=360");
    if (!w) { alert("Autorise les pop-ups pour mytennis, puis reclique le favori."); return; }
    const origin = new URL(RCV).origin; const post = (m) => w.postMessage(m, origin);

    const onmsg = async (e) => {
      if (!e.data || e.data.type !== "prosp-ready") return;
      window.removeEventListener("message", onmsg);
      const rows = []; const LIM = 500; let offset = 0, done = false, guard = 0;
      while (!done && guard++ < 80) {
        post({ type: "prosp-progress", text: `Récupération des classements… ${rows.length} joueurs` });
        let j; try { j = await gql(Q, { where, orderBy, limit: LIM, offset }, token); } catch (err) { break; }
        const list = (j.data && j.data.lizenz_nehmer) || [];
        if (!list.length) break;
        for (const o of list) {
          rows.push({
            license: o.licenceNumber, first: o.person && o.person.firstname, last: o.person && o.person.lastname,
            classification: o.classification, value: o.classificationValue, position: o.ranking,
            ageCategory: o.ageCategoryRedundant, club: (o.clubs && o.clubs[0] && o.clubs[0].club && o.clubs[0].club.name) || null,
            canton: o.person && o.person.canton, gender: o.person && o.person.gender, mtId: o.person && o.person.id,
          });
        }
        if (!list.some((o) => isR7(o.classification))) done = true;   // trié desc → plus aucun R7+ = fini
        if (list.length < LIM) done = true;
        offset += LIM;
      }
      post({ type: "prosp-data", key: KEY, rows });
    };
    window.addEventListener("message", onmsg);
    setTimeout(() => window.removeEventListener("message", onmsg), 600000);
  } catch (e) { alert("Erreur bookmarklet : " + e.message); }
})();
