-- Feuille de match du jeune en DEUX temps (27.09.2026, décision Dan).
--   • AVANT le match : infos du match + stratégie + les questions de préparation mentale (ex-formulaire
--     « Compétition › Préparation » du Mental). Le jeune valide cette partie : elle est alors figée.
--   • APRÈS le match : résultat + analyse + les questions d'analyse mentale (ex « Compétition › Analyse »)
--     + auto-évaluations. Le jeune envoie la feuille : elle est alors figée pour de bon. Pour un changement
--     important, il écrit au secrétariat (un admin peut corriger en console).
-- Les formulaires « Compétition » du Mental disparaissent (table vide au 27.09.2026) : tout passe par la
-- feuille de match. Le coach mental lit toutes les feuilles de match dans la console (onglet Feuille de match).

alter table public.match_reports add column if not exists competition text;
alter table public.match_reports add column if not exists prep jsonb not null default '{}'::jsonb;
alter table public.match_reports add column if not exists bilan jsonb not null default '{}'::jsonb;
alter table public.match_reports add column if not exists pre_sent_at timestamptz;   -- avant-match validé (joueur)
alter table public.match_reports add column if not exists sent_at timestamptz;       -- feuille envoyée (joueur)

-- Garde uniquement les textes non vides d'un objet JSON, pour une liste de clés autorisées (≤ 4000 car. chacun).
create or replace function public.mr_pick(p jsonb, keys text[]) returns jsonb
language sql immutable set search_path = public as $$
  select coalesce(jsonb_object_agg(k, left(btrim(p->>k), 4000)), '{}'::jsonb)
  from unnest(keys) k where coalesce(btrim(p->>k), '') <> '';
$$;
create or replace function public.mr_txt(p jsonb, k text) returns text
language sql immutable set search_path = public as $$ select nullif(left(btrim(coalesce(p->>k, '')), 4000), ''); $$;
create or replace function public.mr_rate(p jsonb, k text) returns integer
language sql immutable set search_path = public as $$
  select case when (p->>k) ~ '^[1-5]$' then (p->>k)::int end;
$$;

-- 1) Valider l'avant-match : crée la feuille du jeune (figée pour cette partie).
create or replace function public.portal_mr_pre(p_youth uuid, p_data jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_name text; v_id uuid;
begin
  if not can_read_public_of(p_youth) then raise exception 'Accès refusé pour ce jeune'; end if;
  if nullif(p_data->>'match_date', '') is null then raise exception 'Indique la date du match'; end if;
  select trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) into v_name from people where id = p_youth;
  insert into match_reports(youth_person_id, author_role, author_person_id, author_name, created_by,
    match_date, competition, opponent, opponent_ranking, strategy_pre, opp_sw, opp_style, prep, pre_sent_at)
  values (p_youth, 'joueur', p_youth, v_name, auth.uid(),
    (p_data->>'match_date')::date, mr_txt(p_data, 'competition'), mr_txt(p_data, 'opponent'), mr_txt(p_data, 'opponent_ranking'),
    mr_txt(p_data, 'strategy_pre'), mr_txt(p_data, 'opp_sw'), mr_txt(p_data, 'opp_style'),
    mr_pick(p_data->'prep', array['horaires', 'specifique', 'represente', 'objectifs', 'tester', 'sentir']), now())
  returning id into v_id;
  return v_id;
end $$;

-- 2) Envoyer l'après-match : complète la feuille puis la fige définitivement.
create or replace function public.portal_mr_post(p_youth uuid, p_id uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare r match_reports;
begin
  if not can_read_public_of(p_youth) then raise exception 'Accès refusé pour ce jeune'; end if;
  select * into r from match_reports where id = p_id and youth_person_id = p_youth and author_role = 'joueur';
  if r.id is null then raise exception 'Feuille introuvable'; end if;
  if r.pre_sent_at is null then raise exception 'Valide d''abord l''avant-match'; end if;
  if r.sent_at is not null then raise exception 'Feuille déjà envoyée : elle ne peut plus être modifiée'; end if;
  if coalesce(p_data->>'result', '') not in ('gagne', 'perdu') then raise exception 'Indique le résultat du match'; end if;
  update match_reports set
    result = p_data->>'result', score = mr_txt(p_data, 'score'),
    opponent = coalesce(opponent, mr_txt(p_data, 'opponent')),
    opponent_ranking = coalesce(opponent_ranking, mr_txt(p_data, 'opponent_ranking')),
    how_won = mr_txt(p_data, 'how_won'), how_lost = mr_txt(p_data, 'how_lost'),
    did_well = mr_txt(p_data, 'did_well'), to_improve = mr_txt(p_data, 'to_improve'),
    three_positives = mr_txt(p_data, 'three_positives'), comment = mr_txt(p_data, 'comment'),
    bilan = mr_pick(p_data->'bilan', array['highlight', 'avant', 'pendant', 'apres', 'different', 'retour_coach', 'appris']),
    r_attitude = mr_rate(p_data, 'r_attitude'), r_mindset = mr_rate(p_data, 'r_mindset'), r_legs = mr_rate(p_data, 'r_legs'),
    r_relax = mr_rate(p_data, 'r_relax'), r_objectives = mr_rate(p_data, 'r_objectives'), r_combative = mr_rate(p_data, 'r_combative'),
    sent_at = now(), updated_at = now()
  where id = p_id;
end $$;

revoke all on function public.portal_mr_pre(uuid, jsonb), public.portal_mr_post(uuid, uuid, jsonb) from public, anon;
grant execute on function public.portal_mr_pre(uuid, jsonb), public.portal_mr_post(uuid, uuid, jsonb) to authenticated;

-- L'ancienne saisie en un seul coup n'a plus lieu d'être (elle contournerait le verrou).
drop function if exists public.portal_save_match_report(uuid, jsonb);

-- Le coach mental lit toutes les feuilles de match (lecture seule).
drop policy if exists mr_mental_read on public.match_reports;
create policy mr_mental_read on public.match_reports for select to authenticated
  using (exists (select 1 from user_roles where user_id = auth.uid() and role::text = 'coach_mental'));

-- Fin des formulaires « Compétition » du Mental (table vide).
drop function if exists public.portal_save_comp_form(uuid, uuid, jsonb);
drop function if exists public.portal_delete_comp_form(uuid, uuid);
drop function if exists public.portal_comp_forms(uuid);
drop table if exists public.mental_comp_forms;
