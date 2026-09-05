-- 28_last_scores.sql
-- Onglet « Last scores » : résultats récents (player_matches) des personnes du répertoire.
-- Le classement du JOUEUR n'est pas stocké → on le retrouve via cross-lookup : la classification
-- enregistrée quand ce joueur apparaît comme ADVERSAIRE (opponent_mt_id) dans un autre match.
-- Perf = victoire contre un adversaire mieux classé (rang N1<N4<R1<…<R9).
create or replace function public.last_scores(p_days int default 28)
returns table(
  match_date date, tournament_name text, person_id uuid, person_name text,
  person_class text, opponent_name text, opponent_class text, score text, won boolean, is_perf boolean
) language sql stable security definer set search_path = public as $$
  with rank_of as (
    select * from (values
      ('N1',1),('N2',2),('N3',3),('N4',4),
      ('R1',5),('R2',6),('R3',7),('R4',8),('R5',9),('R6',10),('R7',11),('R8',12),('R9',13)
    ) v(cl, rk)
  ),
  pclass as (
    select i.person_id, (array_agg(o.opponent_classification order by o.match_date desc, o.imported_at desc))[1] as cl
    from (select distinct person_id, mt_person_id from player_matches where mt_person_id is not null) i
    join player_matches o on o.opponent_mt_id = i.mt_person_id and o.opponent_classification is not null
    group by i.person_id
  )
  select m.match_date,
         regexp_replace(m.tournament_name, '^[0-9]+\s+', '') as tournament_name,
         m.person_id,
         trim(coalesce(pe.first_name,'')||' '||coalesce(pe.last_name,'')) as person_name,
         pc.cl as person_class,
         nullif(trim(coalesce(m.opponent_first,'')||' '||coalesce(m.opponent_last,'')),'') as opponent_name,
         m.opponent_classification as opponent_class,
         m.score, m.won,
         (m.won is true and rp.rk is not null and ro.rk is not null and ro.rk < rp.rk) as is_perf
  from player_matches m
  join people pe on pe.id = m.person_id
  left join pclass pc on pc.person_id = m.person_id
  left join rank_of rp on rp.cl = pc.cl
  left join rank_of ro on ro.cl = m.opponent_classification
  where is_staff(auth.uid())
    and m.person_id is not null
    and coalesce(m.is_double,false) = false
    and m.match_date >= current_date - (p_days || ' days')::interval
    and (m.won is not null or coalesce(m.score,'') <> '')
    -- seulement les joueurs d'une filiere academie (role_periods = source des filieres par saison)
    and exists (select 1 from role_periods rpp where rpp.person_id = m.person_id
                and rpp.role in ('kidstennis','club','competition','performance','sport-etudes','pro-u18','pro'))
  order by m.match_date desc, tournament_name, person_name;
$$;
grant execute on function public.last_scores(int) to authenticated;
