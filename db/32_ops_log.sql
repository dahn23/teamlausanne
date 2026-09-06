-- 32_ops_log.sql
-- Journal des actions d'actualisation (« qui a pris la peine d'actualiser ») pour le Dashboard.
-- Les pages receiver (import matchs / classements / scan résultats) appellent ops_log_write
-- avec la session du user connecté après un import réussi.
create table if not exists public.ops_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,               -- 'matchs' | 'classements' | 'scan'
  at timestamptz not null default now(),
  by_person uuid, by_name text
);
create index if not exists ops_log_action_idx on public.ops_log(action, at desc);
alter table public.ops_log enable row level security;
drop policy if exists ops_log_read on public.ops_log;
create policy ops_log_read on public.ops_log for select using (is_staff(auth.uid()));
grant select on public.ops_log to authenticated;

create or replace function public.ops_log_write(p_action text)
returns void language plpgsql security definer set search_path=public as $$
declare v_name text; v_person uuid;
begin
  if auth.uid() is null or not is_staff(auth.uid()) then return; end if;
  select pr.person_id, trim(coalesce(pe.first_name,'')||' '||coalesce(pe.last_name,''))
    into v_person, v_name from profiles pr join people pe on pe.id=pr.person_id where pr.user_id=auth.uid() limit 1;
  insert into public.ops_log(action, by_person, by_name) values (p_action, v_person, nullif(v_name,''));
end;$$;
grant execute on function public.ops_log_write(text) to authenticated;

-- Variante avec nom fourni : le favori (généré depuis la console où l'user est connecté)
-- embarque le nom (__WHO__) et la page relais l'enregistre — fiable même si la popup n'a pas de session.
create or replace function public.ops_log_named(p_action text, p_name text)
returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.ops_log(action, by_name) values (p_action, nullif(p_name,''));
end;$$;
grant execute on function public.ops_log_named(text, text) to anon, authenticated;

-- Version « intelligente » utilisée par les pages relais : prend d'abord le nom de la
-- SESSION (le vrai cliqueur, automatique), sinon le nom porté par le favori ; ignore « __WHO__ ».
create or replace function public.ops_log_smart(p_action text, p_name text)
returns void language plpgsql security definer set search_path=public as $$
declare v_name text;
begin
  select trim(coalesce(pe.first_name,'')||' '||coalesce(pe.last_name,'')) into v_name
    from profiles pr join people pe on pe.id=pr.person_id where pr.user_id=auth.uid() limit 1;
  if v_name is null or v_name='' then v_name := nullif(p_name,''); end if;
  if v_name = '__WHO__' then v_name := null; end if;
  insert into public.ops_log(action, by_name) values (p_action, v_name);
end;$$;
grant execute on function public.ops_log_smart(text, text) to anon, authenticated;

-- dash_general lit désormais ops_log (date + auteur) pour matchs/classements/scan,
-- avec repli sur les max(imported_at)/last_ranking_scan si aucun log encore.
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
ol as (select distinct on (action) action, at, by_name from ops_log order by action, at desc)
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
 'unvalidated_et',(select coalesce(jsonb_agg(jsonb_build_object('date',day) order by day desc),'[]') from pastet)
);
$$;
revoke execute on function public.dash_general() from public;
