-- 31_dashboard.sql
-- Onglet « Dashboard » (head_coach / admin / superadmin) : vue anti-oubli.
-- Marqueur « répondu » sur les mails (distinct de « traité » manuel).
alter table public.mail_messages add column if not exists replied boolean not null default false;
alter table public.mail_messages add column if not exists replied_at timestamptz;
-- (mail-send v14 pose replied=true/replied_at lors d'une réponse.)

-- Sous-fonctions SECURITY DEFINER (accès direct RÉVOQUÉ ; appelées seulement par dashboard_data).
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
    and not exists(select 1 from etudes_attendance a where a.day_id=d.id and a.status is not null and a.status<>'not_planned'))
select jsonb_build_object(
 'lastup', jsonb_build_object(
    'gz_at',(select ts from gz),
    'gz_by',(select trim(coalesce(pe.first_name,'')||' '||coalesce(pe.last_name,'')) from gz join profiles pr on pr.user_id=gz.created_by join people pe on pe.id=pr.person_id limit 1),
    'matchs_at',(select max(imported_at) from player_matches),
    'scan_at',(select max(imported_at) from prospect_matches),
    'rank_at',(select max(last_ranking_scan) from prospects)),
 'nocoach',(select coalesce(jsonb_agg(jsonb_build_object('date',course_date,'label',label) order by course_date,start_time),'[]') from nocoach),
 'coachabs',(select coalesce(jsonb_agg(jsonb_build_object('date',course_date,'label',label) order by course_date,start_time),'[]') from coachabs),
 'unvalidated',(select coalesce(jsonb_agg(jsonb_build_object('date',course_date,'label',label) order by course_date desc),'[]') from pastc),
 'unvalidated_et',(select coalesce(jsonb_agg(jsonb_build_object('date',day) order by day desc),'[]') from pastet)
);
$$;

create or replace function public.dash_mail() returns jsonb
language sql stable security definer set search_path=public as $$
select jsonb_build_object(
 'boxes',(select coalesce(jsonb_agg(jsonb_build_object('label',a.label,'addr',a.address,
     'recv7',(select count(*) from mail_messages m where m.direction='in' and m.account_address=a.address and m.received_at>=now()-interval '7 days')
   ) order by a.sort_order),'[]') from mail_accounts a where a.active),
 'a_traiter',(select count(*) from mail_messages where direction='in' and status='a_traiter'),
 'done7',(select coalesce(jsonb_agg(jsonb_build_object('who',who,'traite',traite,'repondu',repondu) order by (traite+repondu) desc),'[]') from (
     select trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) who,
       count(*) filter (where not coalesce(m.replied,false)) traite,
       count(*) filter (where coalesce(m.replied,false)) repondu
     from mail_messages m left join people p on p.id=m.treated_by
     where m.status='traite' and m.treated_at>=now()-interval '7 days' group by 1) s),
 'avg_all_h',(select round((extract(epoch from avg(treated_at-received_at))/3600)::numeric,1) from mail_messages where status='traite' and treated_at is not null and received_at is not null),
 'avg_by',(select coalesce(jsonb_agg(jsonb_build_object('who',who,'hours',hours,'n',n) order by n desc),'[]') from (
     select trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) who,
       round((extract(epoch from avg(m.treated_at-m.received_at))/3600)::numeric,1) hours, count(*) n
     from mail_messages m join people p on p.id=m.assigned_user
     where m.status='traite' and m.treated_at is not null and m.received_at is not null group by 1) t)
);
$$;

create or replace function public.dash_group(roles text[]) returns jsonb
language sql stable security definer set search_path=public as $$
with season as (select id,start_date,end_date from seasons where kind='juniors' and current_date between start_date and end_date order by start_date desc limit 1),
yth as (select distinct rp.person_id pid from role_periods rp join season s on rp.season_id=s.id where rp.role = any(roles)),
ynames as (select y.pid, trim(coalesce(pe.first_name,'')||' '||coalesce(pe.last_name,'')) nm from yth y join people pe on pe.id=y.pid)
select jsonb_build_object(
 'youths',(select coalesce(jsonb_agg(jsonb_build_object(
    'name',n.nm,
    'absences',(select coalesce(jsonb_agg(jsonb_build_object('date',c.course_date,'label',coalesce(nullif(c.title,''),ct.name,'Cours')) order by c.course_date desc),'[]')
       from attendance a join courses c on c.id=a.course_id left join course_types ct on ct.id=c.course_type_id
       where a.person_id=n.pid and not a.is_coach and a.status='absent' and c.course_date>=current_date-10)
     || (select coalesce(jsonb_agg(jsonb_build_object('date',d.day,'label','Études') order by d.day desc),'[]')
       from etudes_attendance ea join etudes_days d on d.id=ea.day_id where ea.youth_person_id=n.pid and ea.status='absent' and d.day>=current_date-10),
    'retards',(select coalesce(jsonb_agg(jsonb_build_object('date',c.course_date,'label',coalesce(nullif(c.title,''),ct.name,'Cours')) order by c.course_date desc),'[]')
       from attendance a join courses c on c.id=a.course_id left join course_types ct on ct.id=c.course_type_id
       where a.person_id=n.pid and not a.is_coach and a.status='late' and c.course_date>=current_date-10)
     || (select coalesce(jsonb_agg(jsonb_build_object('date',d.day,'label','Études') order by d.day desc),'[]')
       from etudes_attendance ea join etudes_days d on d.id=ea.day_id where ea.youth_person_id=n.pid and ea.status='late' and d.day>=current_date-10),
    'tennis_last',(select max(created_at) from tennis_notes where player_person_id=n.pid),
    'coach_forms',(select count(*) from match_reports mr, season s where mr.youth_person_id=n.pid and mr.author_role='coach' and mr.created_at>=s.start_date and mr.created_at < s.end_date + 1)
   ) order by n.nm),'[]') from ynames n),
 'suivi',(select coalesce(jsonb_agg(x order by ord desc),'[]') from (
    select jsonb_build_object('date',yn.created_at,'youth',(select nm from ynames where pid=yn.youth_person_id),'author',yn.author_name,'role',yn.author_role,'body',left(yn.body,140)) x, yn.created_at ord
    from youth_notes yn where yn.youth_person_id in (select pid from yth) order by yn.created_at desc limit 15) z),
 'lastscores',(select coalesce(jsonb_agg(x order by ord desc),'[]') from (
    select jsonb_build_object('date',m.match_date,'youth',(select nm from ynames where pid=m.person_id),'tournament',regexp_replace(m.tournament_name,'^[0-9]+\s+',''),'opponent',trim(coalesce(m.opponent_first,'')||' '||coalesce(m.opponent_last,'')),'oc',m.opponent_classification,'score',m.score,'won',m.won) x, m.match_date ord
    from player_matches m where m.person_id in (select pid from yth) and coalesce(m.is_double,false)=false and m.match_date>=current_date-14 and (m.won is not null or coalesce(m.score,'')<>'')) z),
 'reports',(select coalesce(jsonb_agg(x order by ord desc),'[]') from (
    select jsonb_build_object('date',mr.match_date,'youth',(select nm from ynames where pid=mr.youth_person_id),'opponent',mr.opponent,'score',mr.score,'result',mr.result,'role',mr.author_role) x, coalesce(mr.match_date, mr.created_at::date) ord
    from match_reports mr where mr.youth_person_id in (select pid from yth) order by coalesce(mr.match_date,mr.created_at::date) desc limit 30) z)
);
$$;

create or replace function public.dash_club() returns jsonb
language sql stable security definer set search_path=public as $$
with season as (select id,start_date,end_date from seasons where kind='juniors' and current_date between start_date and end_date order by start_date desc limit 1),
yth as (select distinct rp.person_id pid from role_periods rp join season s on rp.season_id=s.id where rp.role in ('club','kidstennis')),
ev as (select cp.child_person_id pid, (c.course_date + c.start_time) ts, coalesce(a.status::text,'none') st
   from course_participants cp join courses c on c.id=cp.course_id
   left join attendance a on a.course_id=c.id and a.person_id=cp.child_person_id and not a.is_coach
   where cp.child_person_id in (select pid from yth)
     and c.course_date>=current_date-14 and (c.course_date<current_date or (c.course_date=current_date and c.end_time<=current_time))),
seq as (select pid, st, row_number() over(partition by pid order by ts) - row_number() over(partition by pid,st order by ts) grp from ev),
runs as (select pid, count(*) runlen from seq where st='absent' group by pid, grp),
streaks as (select pid, max(runlen) mx from runs group by pid having max(runlen)>2),
lates as (select a.person_id pid, count(*) n from attendance a join courses c on c.id=a.course_id, season s
   where a.person_id in (select pid from yth) and not a.is_coach and a.status='late'
     and c.course_date>=s.start_date and c.course_date<=s.end_date group by a.person_id having count(*)>3)
select jsonb_build_object(
 'abs_streak',(select coalesce(jsonb_agg(jsonb_build_object('name',trim(coalesce(pe.first_name,'')||' '||coalesce(pe.last_name,'')),'streak',mx) order by mx desc),'[]')
    from streaks st join people pe on pe.id=st.pid),
 'retards',(select coalesce(jsonb_agg(jsonb_build_object('name',trim(coalesce(pe.first_name,'')||' '||coalesce(pe.last_name,'')),'n',n) order by n desc),'[]')
    from lates l join people pe on pe.id=l.pid)
);
$$;

create or replace function public.dashboard_data() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
  if not exists (select 1 from user_roles where user_id=auth.uid() and role in ('head_coach','admin','superadmin')) then
    raise exception 'Accès refusé';
  end if;
  return jsonb_build_object(
    'general', dash_general(), 'mail', dash_mail(),
    'se', dash_group(array['pro','pro-u18','sport-etudes']),
    'comp', dash_group(array['competition','performance']),
    'club', dash_club(), 'generated_at', now());
end;$$;

revoke execute on function public.dash_general() from public;
revoke execute on function public.dash_mail() from public;
revoke execute on function public.dash_group(text[]) from public;
revoke execute on function public.dash_club() from public;
grant execute on function public.dashboard_data() to authenticated;
