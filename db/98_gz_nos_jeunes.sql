-- GameZone : marquer « nos jeunes » dans la liste des joueurs d'un tournoi (24.09.2026).
-- Un joueur est « de chez nous » s'il est dans le répertoire (people) ET inscrit dans une filière
-- (kidstennis, club, competition, performance, sport-etudes, pro, pro-u18) pour la saison juniors qui
-- contient la date du tournoi. Dans le répertoire sans filière active à cette date → pas de logo.
-- Rapprochement par numéro de licence (chiffres seuls), sinon nom + prénom.
-- SECURITY DEFINER : le responsable de tournoi ne lit pas people ; la fonction ne renvoie que des ids
-- de participants, jamais de données du répertoire.

create or replace function public.gz_our_players(p_tid uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  with t as (select tournament_date from gz_tournaments where id = p_tid),
  ours as (
    select p.id, regexp_replace(coalesce(p.license_no, ''), '\D', '', 'g') as lic,
           lower(btrim(p.last_name)) as ln, lower(btrim(p.first_name)) as fn
      from people p
     where coalesce(p.is_active, true)
       and exists (
         select 1 from role_periods rp join seasons s on s.id = rp.season_id
          where rp.person_id = p.id and s.kind = 'juniors'
            and (select tournament_date from t) between s.start_date and s.end_date
            and rp.role in ('kidstennis', 'club', 'competition', 'performance', 'sport-etudes', 'pro', 'pro-u18'))
  )
  select distinct gp.id
    from gz_participants gp
    join gz_entries e on e.participant_id = gp.id and e.tournament_id = p_tid
    join ours o on (
          (regexp_replace(coalesce(gp.license_no, ''), '\D', '', 'g') <> '' and regexp_replace(coalesce(gp.license_no, ''), '\D', '', 'g') = o.lic)
       or (lower(btrim(gp.last_name)) = o.ln and lower(btrim(gp.first_name)) = o.fn))
   where is_staff(auth.uid()) or is_gz_official(auth.uid()) or gz_manages(p_tid);
$$;
revoke all on function public.gz_our_players(uuid) from public, anon;
grant execute on function public.gz_our_players(uuid) to authenticated;
