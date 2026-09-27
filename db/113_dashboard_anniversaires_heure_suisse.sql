-- 28.09.2026 : le bloc « Anniversaires » du tableau de bord ne correspondait pas à l'onglet Anniversaires.
--  1) Année bissextile : la date d'anniversaire était recalculée par « nombre de jours depuis le 1er janvier » ;
--     pour une personne née une année bissextile, elle tombait un jour trop tard (après le 28 février).
--     → anniversaire = date de naissance + N années (le 29 février devient le 28 les autres années).
--  2) Heure : la base compte en UTC ; entre minuit et 2 h (été), « aujourd'hui » était encore la veille. Même décalage
--     pour les cours « à venir / passés » des alertes. → toutes les fonctions du tableau de bord en heure suisse.
--  3) Personnes : même liste que l'onglet (au moins un rôle autre que membre, client, GameZone ou stage).

do $$
declare d text; a int; b int;
begin
  d := pg_get_functiondef('public.dash_general()'::regprocedure);
  a := position('bd0 as (' in d);
  b := position(E'select jsonb_build_object(\n ''lastup''' in d);
  if a = 0 or b = 0 or b < a then raise exception 'dash_general : structure inattendue, rien modifié'; end if;
  d := left(d, a - 1) || $new$bd0 as (select pe.first_name, pe.last_name, pe.birthdate
  from people pe where pe.birthdate is not null and coalesce(pe.is_active,true) and not people_external_only(pe.id)
    and exists (select 1 from person_roles r where r.person_id = pe.id and r.role not in ('membre','client','gamezone','stage'))),
bd1 as (
  select b0.first_name, b0.last_name, b0.birthdate,
         (b0.birthdate + make_interval(years => (extract(year from current_date)::int + k - extract(year from b0.birthdate)::int)))::date an
  from bd0 b0 cross join (values (-1), (0), (1)) v(k)),
bday as (select trim(coalesce(first_name,'')||' '||coalesce(last_name,'')) nm, (an-current_date) off,
  extract(year from age(an, birthdate))::int age_turn from bd1 where (an-current_date) between -3 and 3)
$new$ || substr(d, b);
  execute d;
end $$;

-- current_date / current_time suivent le fuseau de la fonction : heure suisse pour tout le tableau de bord.
alter function public.dash_general() set timezone to 'Europe/Zurich';
alter function public.dash_group(text[]) set timezone to 'Europe/Zurich';
alter function public.dash_club() set timezone to 'Europe/Zurich';
alter function public.dash_mail() set timezone to 'Europe/Zurich';
alter function public.dash_notes(integer) set timezone to 'Europe/Zurich';
alter function public.dash_prospects() set timezone to 'Europe/Zurich';
alter function public.dashboard_data() set timezone to 'Europe/Zurich';

-- Correctif (même jour) : les filières des jeunes sont des rôles DE SAISON (role_periods), pas des tags de fiche.
-- Comme l'onglet : tags de la fiche + rôles des saisons en cours, hors membre / client / GameZone / stage.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.dash_general()'::regprocedure);
  if position('and exists (select 1 from person_roles r where r.person_id = pe.id and r.role not in (''membre'',''client'',''gamezone'',''stage''))' in d) = 0 then
    raise exception 'dash_general : filtre attendu introuvable, rien modifié';
  end if;
  d := replace(d, 'and exists (select 1 from person_roles r where r.person_id = pe.id and r.role not in (''membre'',''client'',''gamezone'',''stage''))',
    'and (exists (select 1 from person_roles r where r.person_id = pe.id and r.role not in (''membre'',''client'',''gamezone'',''stage''))
      or exists (select 1 from role_periods rp join seasons s on s.id = rp.season_id where rp.person_id = pe.id
                 and current_date between s.start_date and s.end_date and rp.role not in (''membre'',''client'',''gamezone'',''stage'')))');
  execute d;
end $$;
alter function public.dash_general() set timezone to 'Europe/Zurich';
