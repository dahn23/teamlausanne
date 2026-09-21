-- 81 — Mental, liste des participants : naissance, classement et bilan de matchs par jeune (21.09.2026).
-- Passe par une fonction SECURITY DEFINER : le coach mental n'est pas « staff » au sens RLS et ne peut lire
-- ni player_matches ni prospects. La fonction ne renvoie que des compteurs, pas le détail des matchs.
--   • classement : vient du scan des classements Swiss Tennis (table prospects, rapprochée par n° de licence) ;
--   • matchs : simples uniquement (import mytennis) ; un match sans résultat connu compte dans le total, ni en V ni en D.
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
  select p.id, p.birthdate, pr.classification, pr.ranking_position, pr.last_ranking_scan::date,
    (count(m.id) filter (where m.match_date >= current_date - 30))::int,
    (count(m.id) filter (where m.match_date >= current_date - 30 and m.won))::int,
    (count(m.id) filter (where m.match_date >= current_date - 30 and m.won = false))::int,
    count(m.id)::int,
    (count(m.id) filter (where m.won))::int,
    (count(m.id) filter (where m.won = false))::int,
    min(m.match_date), max(m.match_date)
  from people p
  join (select distinct rp.person_id from role_periods rp
        where rp.season_id = p_season and rp.role in ('sport-etudes', 'pro', 'pro-u18')) y on y.person_id = p.id
  left join prospects pr on pr.license_no = p.license_no
  left join player_matches m on m.person_id = p.id and not coalesce(m.is_double, false)
  group by p.id, p.birthdate, pr.classification, pr.ranking_position, pr.last_ranking_scan;
end $$;

revoke all on function public.mental_participants_stats(uuid) from public, anon;
grant execute on function public.mental_participants_stats(uuid) to authenticated;
