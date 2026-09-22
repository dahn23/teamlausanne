(async () => {
  try {
    const HASURA = "https://hasura.swisstennis.ch/v1/graphql";
    const SEARCH = "https://high-scalability.microservices.swisstennis.ch/player-autocomplete-query";
    if (!/mytennis\.ch|swisstennis/.test(location.host)) {
      alert("Ouvre d'abord mytennis.ch (connecté), puis clique ce favori."); return;
    }
    const ask = prompt("Id joueur Swiss Tennis (ex. 60369), numéro de licence (ex. 432.85.485.0) ou nom :");
    if (!ask) return;
    const q = ask.trim();

    // jetons présents dans la session mytennis
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
    let token = null;
    for (const t of jwts) {
      try { const j = await gql("{person(limit:1){id}}", {}, t); if (j && j.data && j.data.person) { token = t; break; } } catch (e) { /* suivant */ }
    }
    if (!token) { alert("Aucun jeton mytennis valable : connecte-toi sur mytennis.ch puis relance le favori."); return; }

    // champs disponibles (introspection) : on prend tout ce qui est scalaire
    const scalarFields = async (typeName) => {
      const j = await gql("query($n:String!){__type(name:$n){fields{name args{name} type{kind name ofType{kind name ofType{kind name}}}}}}", { n: typeName }, token);
      const fs = (j.data && j.data.__type && j.data.__type.fields) || [];
      const leaf = (t) => { while (t && (t.kind === "NON_NULL" || t.kind === "LIST")) t = t.ofType; return t; };
      const scal = [], obj = [], withArgs = [];
      for (const f of fs) {
        const l = leaf(f.type); if (!l) continue;
        if (l.kind === "SCALAR" || l.kind === "ENUM") { if (f.args && f.args.length) withArgs.push(f.name + "(" + f.args.map((a) => a.name).join(",") + ")"); else scal.push(f.name); }
        else obj.push({ name: f.name, type: l.name });
      }
      return { scal, obj, withArgs };
    };
    const pf = await scalarFields("person");
    const lnObj = pf.obj.find((o) => o.name === "lizenz_nehmer");
    const lf = lnObj ? await scalarFields(lnObj.type) : { scal: [], obj: [] };
    // tables de la racine qui parlent de classement / rang (pour savoir ce qui existe)
    const root = await gql("{__schema{queryType{fields{name}}}}", {}, token);
    const rootNames = ((root.data && root.data.__schema.queryType.fields) || []).map((f) => f.name);
    const interesting = rootNames.filter((n) => /class|rank|rating|licen|histor/i.test(n));

    // trouver la personne : par id, par licence, ou par nom (recherche publique)
    let where = null, note = "";
    if (/^\d+$/.test(q)) where = "{id:{_eq:" + q + "}}";
    else if (/^\d{3}\.\d{2}\.\d{3}\.\d$/.test(q)) where = "{lizenz_nehmer:{licenceNumber:{_eq:\"" + q + "\"}}}";
    else {
      const r = await fetch(SEARCH, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyword: q, offset: 0, limit: 20 }) });
      const j = await r.json();
      const hits = ((j && j.hits && j.hits.hits) || []).map((h) => h._source);
      if (!hits.length) { alert("Aucun joueur trouvé pour « " + q + " »."); return; }
      let hit = hits[0];
      if (hits.length > 1) {
        const choice = prompt(hits.map((h, i) => (i + 1) + ") " + h.firstName + " " + h.lastName + " " + h.licenseNr + " " + h.classification).join("\n") + "\n\nNuméro du joueur :", "1");
        hit = hits[Math.max(0, Math.min(hits.length, parseInt(choice || "1", 10)) - 1)];
      }
      where = "{id:{_eq:" + hit.id + "}}";
      note = "Trouvé via la recherche publique : " + hit.firstName + " " + hit.lastName + " (" + hit.licenseNr + ", statut licence " + hit.licenseStatus + ")";
    }
    const sel = pf.scal.join(" ") + (lnObj ? " lizenz_nehmer{" + lf.scal.join(" ") + "}" : "");
    const pj = await gql("{person(where:" + where + "){" + sel + "}}", {}, token);
    const person = pj.data && pj.data.person && pj.data.person[0];
    if (!person) { alert("Fiche introuvable via l'API" + (pj.errors ? " : " + pj.errors[0].message : ".") + "\n\nChamps person : " + pf.scal.join(", ")); return; }

    const Q_SINGLES = "query($id:Int!){results:AllSingleResults(where:{playerPersonId:{_eq:$id}},order_by:{date:desc},limit:500){date tournamentName adversaryFirstname adversaryLastname playerSet1WonGames adversarySet1WonGames playerSet2WonGames adversarySet2WonGames playerSet3WonGames adversarySet3WonGames playerWinnerCode adversary{classification ranking}}}";
    const sj = await gql(Q_SINGLES, { id: person.id }, token);
    const matches = (sj.data && sj.data.results) || [];
    const score = (m) => { const p = []; for (let s = 1; s <= 3; s++) { const a = m["playerSet" + s + "WonGames"], b = m["adversarySet" + s + "WonGames"]; if (a == null || b == null || a < 0 || b < 0 || (a === 0 && b === 0)) continue; p.push(a + "-" + b); } return p.join(" "); };

    const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const rows = (o) => Object.entries(o || {}).filter(([k, v]) => v != null && typeof v !== "object").map(([k, v]) => "<tr><td style='color:#666;padding:2px 10px 2px 0'>" + esc(k) + "</td><td><b>" + esc(v) + "</b></td></tr>").join("");
    const ln = Array.isArray(person.lizenz_nehmer) ? person.lizenz_nehmer : (person.lizenz_nehmer ? [person.lizenz_nehmer] : []);
    const won = (m) => m.playerWinnerCode === 1 || m.playerWinnerCode === true;
    const wins = matches.filter(won).length;
    const rel = (o) => (o || []).map((r) => r.name + "→" + r.type);
    const dump = { person, matches, fields: { person: pf.scal, person_relations: rel(pf.obj), person_calcules: pf.withArgs, lizenz_nehmer: lf.scal, lizenz_nehmer_relations: rel(lf.obj), lizenz_nehmer_calcules: lf.withArgs, autres_tables: interesting } };

    const old = document.getElementById("tl-player-box"); if (old) old.remove();
    const box = document.createElement("div"); box.id = "tl-player-box";
    box.style.cssText = "position:fixed;inset:20px;z-index:2147483647;background:#fff;color:#111;border:2px solid #123cc4;border-radius:12px;padding:16px;overflow:auto;font:14px/1.4 system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.35)";
    box.innerHTML =
      "<div style='display:flex;gap:10px;align-items:center;margin-bottom:10px'><b style='font-size:18px'>" + esc(person.firstname) + " " + esc(person.lastname) + "</b> <span style='color:#666'>id " + esc(person.id) + "</span><span style='flex:1'></span>" +
      "<button id='tl-pb-copy' style='padding:6px 12px'>Copier le JSON</button><button id='tl-pb-close' style='padding:6px 12px'>Fermer</button></div>" +
      (note ? "<p style='color:#666;margin:0 0 8px'>" + esc(note) + "</p>" : "") +
      "<div style='display:flex;gap:30px;flex-wrap:wrap'><div><h3 style='margin:8px 0'>Personne</h3><table>" + rows(person) + "</table></div>" +
      ln.map((l, i) => "<div><h3 style='margin:8px 0'>Licence" + (ln.length > 1 ? " " + (i + 1) : "") + "</h3><table>" + rows(l) + "</table></div>").join("") + "</div>" +
      "<h3 style='margin:14px 0 6px'>Matchs simples (" + matches.length + ", " + wins + " gagnés)</h3>" +
      (sj.errors ? "<p style='color:#b00'>" + esc(sj.errors[0].message) + "</p>" : "") +
      "<table style='border-collapse:collapse'>" + matches.map((m) => "<tr style='border-top:1px solid #eee'><td style='padding:2px 10px 2px 0'>" + esc((m.date || "").slice(0, 10)) + "</td><td style='padding:2px 10px 2px 0'>" + esc(m.tournamentName) + "</td><td style='padding:2px 10px 2px 0'>" + esc(m.adversaryFirstname + " " + m.adversaryLastname) + " <span style='color:#666'>" + esc(m.adversary && m.adversary.classification) + "</span></td><td style='padding:2px 10px 2px 0'>" + (won(m) ? "<b style='color:#2a7'>V</b>" : "<span style='color:#b00'>D</span>") + "</td><td>" + esc(score(m)) + "</td></tr>").join("") + "</table>" +
      "<h3 style='margin:14px 0 6px'>Champs disponibles dans l'API</h3><p style='color:#666;font-size:12px'>person : " + esc(pf.scal.join(", ")) + "<br>licence : " + esc(lf.scal.join(", ")) + "<br>liens licence : " + esc(rel(lf.obj).join(", ") || "aucun") + "<br>champs calculés (avec paramètres) : " + esc(pf.withArgs.concat(lf.withArgs).join(", ") || "aucun") + "<br>tables classement/rang : " + esc(interesting.join(", ") || "aucune") + "</p>";
    document.body.appendChild(box);
    document.getElementById("tl-pb-close").onclick = () => box.remove();
    document.getElementById("tl-pb-copy").onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(dump, null, 2)); alert("JSON copié : colle-le dans Claude."); } catch (e) { prompt("Copie ce texte :", JSON.stringify(dump)); } };
  } catch (e) { alert("Erreur favori : " + e.message); }
})();
