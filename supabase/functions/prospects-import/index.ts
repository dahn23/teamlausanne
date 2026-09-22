// Edge function : import du module Prospects (scouting).
// Actions : rankings, prospect_ids, recent, geocode, contact.
// v20 (22.09.2026) : prospect_ids paginé — PostgREST tronque à 1000 lignes ; avec 4500 prospects, le favori
// « Résultats » n'analysait que les ~1000 premiers (ex. Alexis Sibeldine, 1391e, jamais de match importé).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const isR7plus = (c: string) => /^(N[1-4]|R[1-7])$/.test(String(c || "").trim().toUpperCase());

function licDecode(lic: string): { birthdate: string; sex: string } | null {
  const m = String(lic ?? "").trim().match(/^(\d+)\.(\d{2})\.(\d)(\d{2})\.(\d+)$/);
  if (!m) return null;
  const yy = +m[2], d1 = +m[3], dc = +m[4];
  if (d1 < 1 || d1 > 8 || dc < 1 || dc > 93) return null;
  const monthOff = Math.floor((dc - 1) / 31);
  const month = ((d1 - 1) % 4) * 3 + 1 + monthOff;
  const day = dc - monthOff * 31;
  let year = 2000 + yy; if (year > new Date().getFullYear()) year -= 100;
  const dt = new Date(year, month - 1, day);
  if (dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
  return { birthdate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, sex: d1 <= 4 ? "M" : "F" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const payload = await req.json().catch(() => ({}));
  const { key, action } = payload;
  const { data: cfg } = await svc.from("gz_config").select("import_key").eq("id", 1).single();
  if (!key || !cfg || key !== cfg.import_key) return json({ error: "Cle d'import invalide." }, 403);

  if (action === "rankings") {
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const now = new Date().toISOString();
    const toUpsert: Record<string, unknown>[] = [];
    let skipped = 0;
    for (const r of rows) {
      const cls = String(r.classification || "").trim().toUpperCase();
      if (!r.license || !isR7plus(cls)) { skipped++; continue; }
      const d = licDecode(r.license);
      toUpsert.push({
        license_no: r.license, first_name: r.first ?? null, last_name: r.last ?? null,
        birthdate: d?.birthdate ?? (typeof r.birthdate === "string" ? r.birthdate.slice(0, 10) : null),
        sex: d?.sex ?? (r.gender === 2 || r.gender === "2" ? "F" : r.gender === 1 || r.gender === "1" ? "M" : null),
        classification: cls, ranking_value: r.value != null ? Number(r.value) : null,
        ranking_position: r.position != null ? Number(r.position) : null, age_category: r.ageCategory ?? null,
        club: r.club ?? null, club_postal_code: r.clubPostalCode ?? null, club_city: r.clubCity ?? null,
        canton: r.canton ?? null, mt_person_id: r.mtId != null ? Number(r.mtId) : null,
        last_ranking_scan: now, updated_at: now,
      });
    }
    let kept = 0;
    for (let i = 0; i < toUpsert.length; i += 500) {
      const { error } = await svc.from("prospects").upsert(toUpsert.slice(i, i + 500), { onConflict: "license_no" });
      if (!error) kept += Math.min(500, toUpsert.length - i);
    }
    return json({ ok: true, kept, skipped, total: rows.length });
  }

  if (action === "prospect_ids") {
    // Lecture PAGINÉE : PostgREST ne renvoie jamais plus de 1000 lignes par requête.
    const all: number[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await svc.from("prospects").select("mt_person_id").not("mt_person_id", "is", null).order("mt_person_id").range(from, from + 999);
      if (error) return json({ error: error.message }, 500);
      for (const r of data ?? []) all.push(Number((r as { mt_person_id: number }).mt_person_id));
      if (!data || data.length < 1000) break;
    }
    const ids = [...new Set(all)];
    return json({ ok: true, ids });
  }

  if (action === "recent") {
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const pids = [...new Set(rows.map((r: { playerPersonId: number }) => r.playerPersonId).filter((x: unknown) => x != null))];
    const map: Record<number, { license_no: string; ranking_value: number | null }> = {};
    for (let i = 0; i < pids.length; i += 500) {
      const { data } = await svc.from("prospects").select("mt_person_id, license_no, ranking_value").in("mt_person_id", pids.slice(i, i + 500));
      for (const p of data ?? []) map[p.mt_person_id] = { license_no: p.license_no, ranking_value: p.ranking_value };
    }
    const byKey: Record<string, Record<string, unknown>> = {};
    const affected = new Set<string>();
    let n = 0;
    for (const r of rows) {
      const p = map[r.playerPersonId]; if (!p) continue;
      const oppVal = r.opponentValue != null ? Number(r.opponentValue) : null;
      const myVal = p.ranking_value != null ? Number(p.ranking_value) : null;
      const upset = r.won === true && oppVal != null && myVal != null && oppVal > myVal;
      const dstr = typeof r.date === "string" ? r.date.slice(0, 10) : null;
      const enc = r.encounterId != null ? String(r.encounterId) : (dstr && r.opponentId != null ? `d${dstr}-${r.opponentId}` : `x${p.license_no}-${n++}`);
      byKey[p.license_no + "|" + enc] = {
        prospect_license: p.license_no, mt_person_id: r.playerPersonId, mt_encounter_id: enc,
        match_date: dstr, is_double: false, tournament_name: r.tournamentName ?? null,
        opponent_first: r.opponentFirst ?? null, opponent_last: r.opponentLast ?? null, opponent_mt_id: r.opponentId ?? null,
        opponent_classification: r.opponentClassification ?? null, opponent_ranking_value: oppVal,
        score: r.score ?? null, won: typeof r.won === "boolean" ? r.won : null, is_upset: upset,
        round: r.round != null ? String(r.round) : null, source: r.source ?? null, raw: r.raw ?? null,
      };
      affected.add(p.license_no);
    }
    const toUpsert = Object.values(byKey);
    let stored = 0, lastErr = null;
    for (let i = 0; i < toUpsert.length; i += 500) {
      const { error } = await svc.from("prospect_matches").upsert(toUpsert.slice(i, i + 500), { onConflict: "prospect_license,mt_encounter_id" });
      if (error) lastErr = error.message; else stored += Math.min(500, toUpsert.length - i);
    }
    for (const lic of affected) {
      const { data: ms } = await svc.from("prospect_matches").select("is_upset").eq("prospect_license", lic);
      await svc.from("prospects").update({ match_count: (ms ?? []).length, upset_count: (ms ?? []).filter((x: { is_upset: boolean }) => x.is_upset).length, updated_at: new Date().toISOString() }).eq("license_no", lic);
    }
    return json({ ok: true, scanned: rows.length, stored, matched: affected.size, licenses: [...affected], upsets: toUpsert.filter((x) => x.is_upset).length, error: lastErr });
  }

  if (action === "geocode") {
    const LAT0 = 46.5310, LNG0 = 6.6250;
    const hav = (la: number, ln: number) => { const R = 6371, d = Math.PI / 180; const dLa = (la - LAT0) * d, dLn = (ln - LNG0) * d; const a = Math.sin(dLa / 2) ** 2 + Math.cos(LAT0 * d) * Math.cos(la * d) * Math.sin(dLn / 2) ** 2; return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); };
    const { data: distinct } = await svc.from("prospects").select("club_postal_code, club_city").not("club_postal_code", "is", null);
    const seen = new Map<string, string | null>();
    for (const r of distinct ?? []) if (r.club_postal_code && !seen.has(r.club_postal_code)) seen.set(r.club_postal_code, r.club_city);
    const { data: cached } = await svc.from("plz_geo").select("plz");
    const cachedSet = new Set((cached ?? []).map((x: { plz: string }) => x.plz));
    const todo = [...seen.keys()].filter((p) => !cachedSet.has(p));
    const batch = todo.slice(0, 40);
    let geocoded = 0;
    for (const plz of batch) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ch&postalcode=${encodeURIComponent(plz)}`;
        const r = await fetch(url, { headers: { "User-Agent": "TeamLausanne-scouting/1.0 (contact@teamlausanne.ch)" } });
        const j = await r.json();
        const hit = Array.isArray(j) && j[0];
        const lat = hit ? Number(hit.lat) : null, lng = hit ? Number(hit.lon) : null;
        const dist = (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) ? hav(lat, lng) : null;
        await svc.from("plz_geo").upsert({ plz, city: seen.get(plz) ?? null, lat, lng, distance_km: dist, updated_at: new Date().toISOString() }, { onConflict: "plz" });
        geocoded++;
      } catch (_e) { /* skip */ }
      await new Promise((res) => setTimeout(res, 300));
    }
    await svc.rpc("propagate_prospect_distances");
    const remaining = todo.length - batch.length;
    return json({ ok: true, geocoded, remaining, done: remaining === 0 });
  }

  // Coordonnees d'un prospect (depuis le portail des licences, par licence)
  if (action === "contact") {
    const { license, email, phone, address, postal_code, city } = payload;
    if (!license) return json({ error: "Licence manquante." }, 400);
    const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (email !== undefined) upd.email = email || null;
    if (phone !== undefined) upd.phone = phone || null;
    if (address !== undefined) upd.address = address || null;
    if (postal_code !== undefined) upd.postal_code = postal_code || null;
    if (city !== undefined) upd.city = city || null;
    const { data, error } = await svc.from("prospects").update(upd).eq("license_no", license).select("id");
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, updated: (data ?? []).length });
  }

  return json({ error: "Action inconnue." }, 400);
});
