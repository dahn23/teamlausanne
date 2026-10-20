-- 190 — Les filières de la famille, pour le portail.
--
-- Demande du 20.10.2026 : Mon espace gagne un onglet Calendrier, et le
-- calendrier n'est pas le même pour tous — école de tennis (kids tennis,
-- club, compétition, performance, adultes), sport-études, et plus tard une
-- version pour les pros.
--
-- Le portail savait jusqu'ici deux choses d'un jeune : s'il est « joueur »
-- (portal_my_youths + is_elite_youth) et s'il est élite. Pas sa filière. Il
-- aurait fallu la deviner côté JavaScript, à partir de signaux indirects —
-- exactement le genre de règle qui se met à diverger de la base.
--
-- Cette fonction rend donc la filière telle qu'elle est écrite : role_periods
-- pour la saison en cours (la source de vérité annuelle), person_roles en
-- complément pour les étiquettes posées hors saison. Un jeune peut en avoir
-- plusieurs (club ET compétition) : une ligne chacune.
--
-- Rien de sensible : un prénom et un nom de filière, que la famille connaît
-- mieux que nous. La garde est celle du portail — sa propre famille — plus
-- l'aperçu de la console (db/187) quand p_youth est renseigné.

begin;

create or replace function public.portal_mes_filieres(p_youth uuid default null)
returns table(person_id uuid, first_name text, filiere text)
language sql stable security definer set search_path to 'public' as $$
  with cibles as (
    select pid from my_family_ids() as pid where p_youth is null
    union all
    select p_youth where p_youth is not null
                     and (can_read_public_of(p_youth) or portal_peut_apercevoir())
  ),
  cur as (select s.id from seasons s
           where s.kind = 'juniors' and current_date between s.start_date and s.end_date
           limit 1),
  filieres as (
    select rp.person_id, rp.role from role_periods rp
      join cibles c on c.pid = rp.person_id
      join cur on cur.id = rp.season_id
    union
    select pr.person_id, pr.role from person_roles pr
      join cibles c on c.pid = pr.person_id
  )
  select f.person_id, pe.first_name, f.role
    from filieres f join people pe on pe.id = f.person_id
   where f.role in ('kidstennis', 'club', 'competition', 'performance',
                    'sport-etudes', 'pro', 'pro-u18', 'adultes', 'prive', 'membre')
   order by pe.first_name, f.role;
$$;

comment on function public.portal_mes_filieres(uuid) is
  'Filières des jeunes de la famille (ou d''un jeune donné) — sert au portail à choisir le bon calendrier.';

revoke all on function public.portal_mes_filieres(uuid) from public, anon;
grant execute on function public.portal_mes_filieres(uuid) to authenticated;

commit;
