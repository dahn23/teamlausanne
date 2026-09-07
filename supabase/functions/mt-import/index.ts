// Edge function : import de l'historique de matchs mytennis.
// Le bookmarklet (page mytennis connectee) interroge l'API GraphQL avec le
// jeton de la session, puis envoie ici les matchs parses. Auth : cle d'import
// (gz_config.import_key), pas de JWT (tourne depuis un autre domaine).
// v8 : GARDE-FOU — on ne supprime JAMAIS les matchs existants d'une licence si le favori n'en renvoie aucun
// (jeton mytennis invalide, session expiree…). Et si le lot entier est vide, on ne touche a rien.
// (Incident 07.09.2026 : un import « vide » avait efface toute la table.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const payload = await req.json().catch(() => ({}));
  const { key, action } = payload;

  const { data: cfg } = await svc.from("gz_config").select("import_key").eq("id", 1).single();
  if (!key || !cfg || key !== cfg.import_key) return json({ error: "Cle d'import invalide." }, 403);

  // 1) Liste des licences du repertoire (pour que le bookmarklet sache quoi chercher)
  if (action === "licenses") {
    const { data } = await svc.from("people")
      .select("id, first_name, last_name, license_no")
      .not("license_no", "is", null);
    const players = (data ?? [])
      .filter((p: { license_no: string | null }) => p.license_no && p.license_no.trim())
      .map((p: { id: string; first_name: string; last_name: string; license_no: string }) =>
        ({ person_id: p.id, name: `${p.first_name} ${p.last_name}`, license: p.license_no.trim() }));
    return json({ ok: true, players });
  }

  // 2) Stockage des matchs (remplacement complet par licence, UNIQUEMENT si des matchs sont recus)
  if (action === "import") {
    const players = Array.isArray(payload.players) ? payload.players : [];
    const total = players.reduce((a: number, pl: { matches?: unknown[] }) => a + (Array.isArray(pl?.matches) ? pl.matches.length : 0), 0);
    if (!total) {
      return json({ ok: false, error: "Aucun match recu de mytennis : rien n'a ete modifie (les matchs existants sont conserves). Verifie que tu es connecte sur mytennis puis relance le favori." });
    }
    const report: unknown[] = [];
    for (const pl of players) {
      if (!pl || !pl.license) continue;
      const { data: person } = await svc.from("people").select("id").eq("license_no", pl.license).maybeSingle();
      const pid = person?.id ?? null;
      const rows = (Array.isArray(pl.matches) ? pl.matches : []).map((m: Record<string, unknown>) => ({
        person_id: pid, license_no: pl.license, mt_person_id: pl.mt_person_id ?? null,
        mt_encounter_id: m.encounterId != null ? String(m.encounterId) : null,
        match_date: typeof m.date === "string" ? m.date.slice(0, 10) : null,
        is_double: !!m.isDouble, tournament_name: (m.tournamentName as string) ?? null,
        opponent_first: (m.opponentFirst as string) ?? null, opponent_last: (m.opponentLast as string) ?? null,
        opponent_mt_id: m.opponentId ?? null, score: (m.score as string) ?? null, sets: m.sets ?? null,
        winner_code: m.winnerCode != null ? String(m.winnerCode) : null,
        won: typeof m.won === "boolean" ? m.won : null,
        round: m.round != null ? String(m.round) : null,
        opponent_ranking: (m.opponentRanking as string) ?? null,
        opponent_classification: (m.opponentClassification as string) ?? null,
        source: (m.source as string) ?? null, raw: m.raw ?? null,
      }));
      if (!rows.length) { report.push({ license: pl.license, matched: !!pid, matches: 0, kept: true }); continue; }  // rien recu : on garde l'existant
      await svc.from("player_matches").delete().eq("license_no", pl.license);
      await svc.from("player_matches").insert(rows);
      report.push({ license: pl.license, matched: !!pid, matches: rows.length });
    }
    return json({ ok: true, report });
  }

  return json({ error: "Action inconnue." }, 400);
});
