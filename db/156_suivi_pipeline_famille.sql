-- Le suivi devient une FILIÈRE, pas trois listes (14.10.2026).
--
-- Raphael : « je dois fixer un appel ET une rencontre en personne pour toutes
-- les familles, idéalement APRÈS que le déjeuner avec Mariano a eu lieu ».
--
-- C'est un enchaînement, et le dire ainsi change tout. Pour chaque joueur :
--
--   1. déjeuner   — Mariano ↔ le joueur (il recueille le ressenti du jeune)
--   2. appel      — Raphael ↔ les parents (premier contact, on prend la
--                   température, on cale la suite)
--   3. rencontre  — Raphael ↔ les parents, en personne
--
-- Trois listes séparées auraient obligé à faire le rapprochement de tête à
-- chaque fois : « est-ce que Nadia a déjà déjeuné ? puis-je appeler ses
-- parents ? ». Une seule ligne par joueur, trois colonnes, et l'ordre
-- d'affichage remonte ceux dont le déjeuner est FAIT et l'appel pas encore :
-- ce sont exactement ceux qu'il faut appeler maintenant.
--
-- `famille` se scinde donc en `famille_appel` et `famille_rdv`, et `appel`
-- (les joueurs performance, sans échéance) devient `perf` — il devenait
-- ambigu à côté de l'appel aux familles.

alter table public.suivi_contacts drop constraint if exists suivi_contacts_kind_check;
update public.suivi_contacts set kind = 'perf' where kind = 'appel';
update public.suivi_contacts set kind = 'famille_appel' where kind = 'famille';
alter table public.suivi_contacts add constraint suivi_contacts_kind_check
  check (kind in ('famille_appel', 'famille_rdv', 'hebdo', 'dejeuner', 'perf'));

create or replace function public.suivi_population(p_kind text)
returns table(person_id uuid, nom text)
language sql stable security definer set search_path to 'public' as $function$
  select p.id, trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,''))
  from people p
  where exists (
    select 1 from role_periods rp
    join seasons s on s.id = rp.season_id
    where rp.person_id = p.id and s.kind = 'juniors'
      and current_date between s.start_date and s.end_date
      and rp.role = any (case when p_kind = 'perf' then array['performance']
                              else array['sport-etudes', 'pro', 'pro-u18'] end))
  order by 2;
$function$;

create or replace function public.suivi_etat(p_kind text)
returns table(person_id uuid, nom text, dernier date, jours integer,
              jours_cible integer, en_retard boolean)
language sql stable security definer set search_path to 'public' as $function$
  with cible as (
    select case p_kind when 'famille_appel' then 180 when 'famille_rdv' then 180
                       when 'dejeuner' then 49 when 'hebdo' then 7 else null end as j
  ),
  dern as (
    select g.person_id, g.nom,
           (select max(c.done_on) from suivi_contacts c
             where c.kind = p_kind and c.person_id = g.person_id and c.done_on is not null) as dernier
    from suivi_population(p_kind) g
  )
  select d.person_id, d.nom, d.dernier,
         case when d.dernier is null then null else (current_date - d.dernier)::int end,
         (select j from cible),
         case when (select j from cible) is null then false
              when d.dernier is null then true
              else (current_date - d.dernier) >= (select j from cible) end
  from dern d
  order by d.dernier nulls first, d.nom;
$function$;

-- La filière, en une ligne par joueur.
--
-- `pret` dit l'essentiel : le déjeuner a eu lieu, l'appel aux parents n'a pas
-- encore été passé. C'est le signal « à faire maintenant », et il remonte en
-- tête de liste.
create or replace function public.suivi_pipeline()
returns table(person_id uuid, nom text,
              dejeuner_on date, dejeuner_prevu date,
              appel_on date, appel_prevu date,
              rdv_on date, rdv_prevu date,
              pret boolean)
language sql stable security definer set search_path to 'public' as $function$
  with g as (select person_id, nom from suivi_population('famille_appel')),
  d as (
    select g.person_id, g.nom,
      (select max(c.done_on)    from suivi_contacts c where c.person_id=g.person_id and c.kind='dejeuner'      and c.done_on is not null) as dej,
      (select min(c.planned_on) from suivi_contacts c where c.person_id=g.person_id and c.kind='dejeuner'      and c.done_on is null)     as dej_p,
      (select max(c.done_on)    from suivi_contacts c where c.person_id=g.person_id and c.kind='famille_appel' and c.done_on is not null) as app,
      (select min(c.planned_on) from suivi_contacts c where c.person_id=g.person_id and c.kind='famille_appel' and c.done_on is null)     as app_p,
      (select max(c.done_on)    from suivi_contacts c where c.person_id=g.person_id and c.kind='famille_rdv'   and c.done_on is not null) as rdv,
      (select min(c.planned_on) from suivi_contacts c where c.person_id=g.person_id and c.kind='famille_rdv'   and c.done_on is null)     as rdv_p
    from g
  )
  select d.person_id, d.nom, d.dej, d.dej_p, d.app, d.app_p, d.rdv, d.rdv_p,
         (d.dej is not null and d.app is null)
  from d
  -- D'abord ceux qui attendent l'appel après leur déjeuner, puis les moins
  -- avancés : la liste dit toujours quoi faire ensuite.
  order by (d.dej is not null and d.app is null) desc,
           (d.app is not null and d.rdv is null) desc,
           d.dej nulls last, d.nom;
$function$;

revoke all on function public.suivi_pipeline() from public, anon;
grant execute on function public.suivi_pipeline() to authenticated;
