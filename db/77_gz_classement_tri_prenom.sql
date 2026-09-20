-- 77 — GameZone, site public : à victoires égales, le classement est trié par PRÉNOM (demande de Dan, 21.09.2026).
create or replace function public.gz_public_ranking(p_season uuid default null::uuid)
 returns table(first_name text, last_name text, wins bigint)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p.first_name, p.last_name, count(distinct t.id) as wins
  from gz_player_status st
  join gz_tournaments t on t.id = st.tournament_id
  join gz_participants p on p.id = st.participant_id
  where st.is_winner = true and t.is_gamezone = true
    and (p_season is null or t.season_id = p_season)
  group by p.id, p.first_name, p.last_name
  having count(distinct t.id) > 0
  order by wins desc, p.first_name, p.last_name;
$function$;
