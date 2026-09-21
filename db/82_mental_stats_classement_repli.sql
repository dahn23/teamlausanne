-- 82 — Mental, participants : classement de repli pour les joueurs hors relevé juniors (21.09.2026).
-- Le relevé Swiss Tennis (table prospects) ne couvre que les moins de 19 ans. Pour un joueur plus âgé
-- (ex. Loris Gander, N4), on prend son classement tel qu'il apparaît, comme ADVERSAIRE, dans le match importé
-- le plus récent (prospect_matches / player_matches, rapproché par son identifiant mytennis).
-- ranking_scan = date du relevé, ou date de ce match.


create or replace function public.mental_participants_stats(p_season uuid)
 returns table(person_id uuid, birthdate date, classification text, ranking_position integer, ranking_scan date,
               m30 integer, m30_won integer, m30_lost integer, total integer, total_won integer, total_lost integer,
               first_match date, last_match date)
 language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not (is_staff(auth.uid()) or has_role(auth.uid(), 'coach_mental')) then
    raise exception 'non autorisé';
  end if;
  return query
  with y as (
    select distinct rp.person_id from role_periods rp
    where rp.season_id = p_season and rp.role in ('sport-etudes', 'pro', 'pro-u18')
  ), agg as (
    select p.id, p.birthdate, p.license_no, max(m.mt_person_id) as mt_id,
      (count(m.id) filter (where m.match_date >= current_date - 30))::int as m30,
      (count(m.id) filter (where m.match_date >= current_date - 30 and m.won))::int as m30w,
      (count(m.id) filter (where m.match_date >= current_date - 30 and m.won = false))::int as m30l,
      count(m.id)::int as tot,
      (count(m.id) filter (where m.won))::int as totw,
      (count(m.id) filter (where m.won = false))::int as totl,
      min(m.match_date) as fm, max(m.match_date) as lm
    from people p join y on y.person_id = p.id
    left join player_matches m on m.person_id = p.id and not coalesce(m.is_double, false)
    group by p.id, p.birthdate, p.license_no
  )
  select a.id, a.birthdate,
    coalesce(pr.classification, opp.cl),
    pr.ranking_position,
    coalesce(pr.last_ranking_scan::date, opp.d),
    a.m30, a.m30w, a.m30l, a.tot, a.totw, a.totl, a.fm, a.lm
  from agg a
  left join prospects pr on pr.license_no = a.license_no
  left join lateral (
    select x.cl, x.d from (
      select pm.opponent_classification as cl, pm.match_date as d from prospect_matches pm
        where a.mt_id is not null and pm.opponent_mt_id = a.mt_id and pm.opponent_classification is not null
      union all
      select m2.opponent_classification, m2.match_date from player_matches m2
        where a.mt_id is not null and m2.opponent_mt_id = a.mt_id and m2.opponent_classification is not null
    ) x order by x.d desc nulls last limit 1
  ) opp on pr.classification is null;
end $$;
