// Edge function : import des tournois + inscrits GameZone depuis le bookmarklet.
// Le bookmarklet (page Swiss Tennis connectée) envoie, par tournoi, les
// métadonnées + le PlayerList.xls en base64. On parse le xls ici et on
// enregistre participants (dédoublonnés par licence) + inscriptions.
// Auth : clé d'import (gz_config), pas de JWT (le bookmarklet tourne sur
// un autre domaine).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const norm = (s: string) => String(s || "").replace(/\s+/g, " ").trim();
const toIso = (d: unknown) => {
  const s = String(d || "");
  const m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const m2 = s.match(/^\d{4}-\d{2}-\d{2}/);
  return m2 ? m2[0] : null;
};
const isTrue = (v: unknown) => /^(vrai|true|1|oui|x)$/i.test(String(v || "").trim());

// Parse le xls → lignes {license,last,first,birth,email,phone,city,club,ranking,comment,epreuve,confirmed}
function parseXls(b64: string) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const wb = XLSX.read(bytes, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  // trouver la ligne d'en-tête (contient "No de licence" ou "Confirm")
  let h = -1;
  for (let i = 0; i < rows.length; i++) {
    const joined = rows[i].map(norm).join("|").toLowerCase();
    if (joined.includes("licence") && joined.includes("nom")) { h = i; break; }
  }
  if (h < 0) return [];
  const head = rows[h].map(norm);
  const col = (names: string[]) => {
    for (const n of names) {
      const i = head.findIndex((c) => c.toLowerCase() === n.toLowerCase());
      if (i >= 0) return i;
    }
    for (const n of names) {
      const i = head.findIndex((c) => c.toLowerCase().includes(n.toLowerCase()));
      if (i >= 0) return i;
    }
    return -1;
  };
  const iLic = col(["No de licence", "licence"]);
  const iLast = col(["Nom"]);
  const iFirst = col(["Prénom"]);
  const iBirth = col(["Date de naissance", "naissance"]);
  const iEmail = col(["Email", "E-mail"]);
  const iPhone = col(["Mobile", "Téléphone", "Natel"]);
  const iCity = col(["Lieu"]);
  const iClub = col(["Nom du club"]);
  const iRank = col(["Classement"]);
  const iComment = col(["Commentaire", "Contraintes"]);
  const iEpreuve = col(["Epreuve"]);
  const iConf = col(["Confirmé", "Confirm"]);
  const firstIdx = iFirst >= 0 ? iFirst : (iLast >= 0 ? iLast + 1 : -1);

  const out = [];
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i];
    const license = norm(r[iLic]);
    const last = norm(r[iLast]);
    if (!last && !license) continue;
    out.push({
      license: license || null,
      last, first: norm(r[firstIdx]),
      birth: toIso(r[iBirth]),
      email: norm(r[iEmail]) || null,
      phone: norm(r[iPhone]) || null,
      city: norm(r[iCity]) || null,
      club: norm(r[iClub]) || null,
      ranking: norm(r[iRank]) || null,
      comment: norm(r[iComment]) || null,
      epreuve: norm(r[iEpreuve]) || null,
      confirmed: isTrue(r[iConf]),
    });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const payload = await req.json().catch(() => ({}));
  const { key, tournaments } = payload;

  const { data: cfg } = await svc.from("gz_config").select("import_key").eq("id", 1).single();
  if (!key || !cfg || key !== cfg.import_key) return json({ error: "Clé d'import invalide." }, 403);
  if (!Array.isArray(tournaments)) return json({ error: "Format invalide." }, 400);

  const report: unknown[] = [];
  for (const t of tournaments) {
    // upsert tournoi (par swiss_id) sans écraser les réglages utilisateur
    const patch: Record<string, unknown> = {
      swiss_id: t.swiss_id, name: t.name || "Tournoi",
      tournament_date: toIso(t.start_date), deadline: toIso(t.deadline),
      draw_date: toIso(t.draw_date), status: t.status || null,
      epreuves: t.epreuves || null, imported_at: new Date().toISOString(),
    };
    let tid: string;
    const { data: existing } = await svc.from("gz_tournaments").select("id").eq("swiss_id", t.swiss_id).maybeSingle();
    if (existing) { await svc.from("gz_tournaments").update(patch).eq("id", existing.id); tid = existing.id; }
    else { const { data: ins } = await svc.from("gz_tournaments").insert(patch).select("id").single(); tid = ins!.id; }

    let players = [];
    try { if (t.players_b64) players = parseXls(t.players_b64); } catch (_e) { /* xls illisible */ }

    // participants (dédoublonnés par licence ; tel mis à jour, reste fixe)
    const byLicense: Record<string, string> = {};
    for (const p of players) {
      if (!p.license) continue;
      if (byLicense[p.license]) continue;
      const { data: ex } = await svc.from("gz_participants").select("id").eq("license_no", p.license).maybeSingle();
      if (ex) { await svc.from("gz_participants").update({ phone: p.phone }).eq("id", ex.id); byLicense[p.license] = ex.id; }
      else {
        const { data: np } = await svc.from("gz_participants").insert({
          license_no: p.license, last_name: p.last, first_name: p.first, birthdate: p.birth,
          email: p.email, phone: p.phone, city: p.city, club: p.club, ranking: p.ranking, comment: p.comment,
        }).select("id").single();
        if (np) byLicense[p.license] = np.id;
      }
    }
    // inscriptions (remplacer pour ce tournoi)
    await svc.from("gz_entries").delete().eq("tournament_id", tid);
    const entries = players.filter((p) => p.license && byLicense[p.license])
      .map((p) => ({ tournament_id: tid, participant_id: byLicense[p.license], epreuve: p.epreuve, confirmed: p.confirmed }));
    if (entries.length) await svc.from("gz_entries").insert(entries);

    const uniquePlayers = Object.keys(byLicense).length;
    const selected = new Set(players.filter((p) => p.confirmed && p.license).map((p) => p.license)).size;
    report.push({ swiss_id: t.swiss_id, players: uniquePlayers, entries: entries.length, selected });
  }
  return json({ ok: true, report });
});
