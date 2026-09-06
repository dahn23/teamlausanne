-- 33_dashboard_birthdays.sql
-- Dashboard > Général : anniversaires à J-3 → J+3 (personnes actives du répertoire), avec l'âge fêté.
-- Recrée dash_general (état final) : dernières MAJ (ops_log), couverture coachs, non validés, anniversaires.
create or replace function public.dash_general() returns jsonb
language sql stable security definer set search_path=public as $$
with
gz as (select coalesce(imported_at,created_at) ts, created_by from gz_tournaments order by coalesce(imported_at,created_at) desc nulls last limit 1),
upc as (select c.id,c.course_date,c.start_time,coalesce(nullif(c.title,''),ct.name,'Cours') label
  from courses c left join course_types ct on ct.id=c.course_type_id
  where (c.course_date>current_date or (c.course_date=current_date and c.end_time>current_time))),
nocoach as (select id,course_date,start_time,label from upc u where not exists(select 1 from course_coaches cc where cc.course_id=u.id)),
coachabs as (select u.id,u.course_date,u.start_time,u.label from upc u
  where exists(select 1 from course_coaches cc where cc.course_id=u.id)
    and not exists(select 1 from course_coaches cc where cc.course_id=u.id
       and not exists(select 1 from attendance a where a.course_id=u.id and a.person_id=cc.coach_person_id and a.is_coach and a.status='absent'))),
pastc as (select c.id,c.course_date,coalesce(nullif(c.title,''),ct.name,'Cours') label
  from courses c left join course_types ct on ct.id=c.course_type_id
  where (c.course_date<current_date or (c.course_date=current_date and c.end_time<=current_time))
    and c.course_date>=current_date-21
    and not exists(select 1 from course_validation v where v.course_id=c.id)
    and not exists(select 1 from attendance a where a.course_id=c.id and not a.is_coach and a.status is not null)),
pastet as (select d.id,d.day from etudes_days d
  where d.day<current_date and d.day>=current_date-21
    and not exists(select 1 from etudes_attendance a where a.day_id=d.id and a.status is not null and a.status<>'not_planned')),
ol as (select distinct on (action) action, at, by_name from ops_log order by action, at desc),
-- anniversaires : on projette la date de naissance sur l'année courante (±1 an pour le passage d'année)
bd0 as (select pe.first_name, pe.last_name, pe.birthdate, (pe.birthdate - date_trunc('year', pe.birthdate)::date) as doy
  from people pe where pe.birthdate is not null and coalesce(pe.is_active,true)),
bd1 as (
  select first_name,last_name,birthdate,(date_trunc('year',current_date)::date + doy) an from bd0
  union all select first_name,last_name,birthdate,((date_trunc('year',current_date)+interval '1 year')::date + doy) from bd0
  union all select first_name,last_name,birthdate,((date_trunc('year',current_date)-interval '1 year')::date + doy) from bd0),
bday as (select trim(coalesce(first_name,'')||' '||coalesce(last_name,'')) nm, (an-current_date) off,
  extract(year from age(an, birthdate))::int age_turn from bd1 where (an-current_date) between -3 and 3)
select jsonb_build_object(
 'lastup', jsonb_build_object(
    'gz_at',coalesce((select at from ol where action='gamezone'),(select ts from gz)),
    'gz_by',coalesce((select by_name from ol where action='gamezone'),(select trim(coalesce(pe.first_name,'')||' '||coalesce(pe.last_name,'')) from gz join profiles pr on pr.user_id=gz.created_by join people pe on pe.id=pr.person_id limit 1)),
    'matchs_at',coalesce((select at from ol where action='matchs'),(select max(imported_at) from player_matches)),
    'matchs_by',(select by_name from ol where action='matchs'),
    'scan_at',coalesce((select at from ol where action='scan'),(select max(imported_at) from prospect_matches)),
    'scan_by',(select by_name from ol where action='scan'),
    'rank_at',coalesce((select at from ol where action='classements'),(select max(last_ranking_scan) from prospects)),
    'rank_by',(select by_name from ol where action='classements')),
 'nocoach',(select coalesce(jsonb_agg(jsonb_build_object('date',course_date,'label',label) order by course_date,start_time),'[]') from nocoach),
 'coachabs',(select coalesce(jsonb_agg(jsonb_build_object('date',course_date,'label',label) order by course_date,start_time),'[]') from coachabs),
 'unvalidated',(select coalesce(jsonb_agg(jsonb_build_object('date',course_date,'label',label) order by course_date desc),'[]') from pastc),
 'unvalidated_et',(select coalesce(jsonb_agg(jsonb_build_object('date',day) order by day desc),'[]') from pastet),
 'birthdays',(select coalesce(jsonb_agg(jsonb_build_object('name',nm,'off',off,'age',age_turn) order by off, nm),'[]') from bday)
);
$$;
revoke execute on function public.dash_general() from public;
