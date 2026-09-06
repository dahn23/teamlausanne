-- 35_etudes_day_complete.sql
-- Heures des profs (études) : un après-midi est validé si la journée est COMPLÈTE, c.-à-d. que tous les
-- jeunes sport-études de la saison ont un statut (présent / retard / absent / pas prévu) — quel que soit
-- celui qui a saisi — OU si le prof a validé explicitement. Heures = saisies, sinon 4 h.
-- (Remplace la règle « le prof a marqué lui-même » de la migration 34.)
create or replace function public.etudes_day_complete(p_day uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists (select 1 from etudes_days d join role_periods rp on rp.season_id = d.season_id and rp.role='sport-etudes' where d.id = p_day)
     and not exists (
       select 1 from etudes_days d join role_periods rp on rp.season_id = d.season_id and rp.role='sport-etudes'
       where d.id = p_day
         and not exists (select 1 from etudes_attendance ea where ea.day_id = d.id and ea.youth_person_id = rp.person_id and ea.status is not null));
$$;
revoke execute on function public.etudes_day_complete(uuid) from public;

create or replace function public.staff_hours_month(p_ym text) returns jsonb
language sql stable security definer set search_path to 'public' as $$
with coach_h as (
  select cc.coach_person_id as pid,
    round(sum(case
        when course_is_detailed(c.id)
          then coalesce((select sum(s.minutes) from course_segments s where s.course_id = c.id and s.coach_person_id = cc.coach_person_id), 0) / 60.0
        when exists (select 1 from attendance a where a.course_id = c.id and a.person_id = cc.coach_person_id and a.is_coach and a.status = 'present') or v.course_id is not null
          then extract(epoch from (c.end_time - c.start_time)) / 3600.0
        else 0 end)::numeric, 2) as hours,
    count(*) filter (where case when course_is_detailed(c.id)
        then exists (select 1 from course_segments s where s.course_id = c.id)
        else (exists (select 1 from attendance a where a.course_id = c.id and a.person_id = cc.coach_person_id and a.is_coach and a.status = 'present') or v.course_id is not null) end) as n_val,
    count(*) as n_total
  from courses c join course_coaches cc on cc.course_id = c.id
  left join course_validation v on v.course_id = c.id and v.coach_person_id = cc.coach_person_id
  where to_char(c.course_date, 'YYYY-MM') = p_ym
  group by cc.coach_person_id
),
prof_h as (
  select dp.prof_person_id as pid,
    count(*) filter (where ev.status='present' or etudes_day_complete(d.id)) as val_days,
    count(*) as total_days,
    coalesce(sum(case when ev.status='present' then coalesce(ev.hours,4) when etudes_day_complete(d.id) then 4 else 0 end),0) as hours
  from etudes_day_profs dp join etudes_days d on d.id = dp.day_id
  left join etudes_day_validation ev on ev.day_id = d.id and ev.prof_person_id = dp.prof_person_id
  where to_char(d.day, 'YYYY-MM') = p_ym
  group by dp.prof_person_id
)
select jsonb_build_object(
  'coaches', coalesce((select jsonb_agg(jsonb_build_object(
      'person_id', ch.pid, 'name', pe.first_name || ' ' || pe.last_name, 'iban', pe.iban,
      'hours', ch.hours, 'courses', ch.n_val, 'total_courses', ch.n_total,
      'rate', (select cr.chf_per_hour from coach_rates cr where cr.person_id = ch.pid and cr.is_default limit 1)
    ) order by pe.last_name) from coach_h ch join people pe on pe.id = ch.pid), '[]'::jsonb),
  'profs', coalesce((select jsonb_agg(jsonb_build_object(
      'person_id', ph.pid, 'name', pe.first_name || ' ' || pe.last_name, 'iban', pe.iban,
      'days', ph.val_days, 'total_days', ph.total_days, 'hours', ph.hours
    ) order by pe.last_name) from prof_h ph join people pe on pe.id = ph.pid), '[]'::jsonb)
);
$$;

create or replace function public.my_hours_month(p_ym text) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  with me as (select person_id as pid from profiles where user_id = auth.uid()),
  pd as (
    select d.id as day_id, ev.status as vstatus, ev.hours as vhours, etudes_day_complete(d.id) as complete
    from etudes_day_profs dp join etudes_days d on d.id = dp.day_id join me on dp.prof_person_id = me.pid
    left join etudes_day_validation ev on ev.day_id = d.id and ev.prof_person_id = me.pid
    where to_char(d.day,'YYYY-MM') = p_ym
  )
  select jsonb_build_object(
    'person_id', (select pid from me),
    'coach_hours', coalesce((select round(sum(case
          when course_is_detailed(c.id)
            then coalesce((select sum(s.minutes) from course_segments s where s.course_id = c.id and s.coach_person_id = me.pid), 0) / 60.0
          when exists (select 1 from attendance a where a.course_id = c.id and a.person_id = me.pid and a.is_coach and a.status = 'present') or v.course_id is not null
            then extract(epoch from (c.end_time - c.start_time)) / 3600.0
          else 0 end)::numeric, 2)
        from courses c join course_coaches cc on cc.course_id = c.id join me on cc.coach_person_id = me.pid
        left join course_validation v on v.course_id = c.id and v.coach_person_id = me.pid where to_char(c.course_date, 'YYYY-MM') = p_ym), 0),
    'coach_val', coalesce((select count(*) filter (where case when course_is_detailed(c.id)
          then exists (select 1 from course_segments s where s.course_id = c.id)
          else (exists (select 1 from attendance a where a.course_id = c.id and a.person_id = me.pid and a.is_coach and a.status = 'present') or v.course_id is not null) end)
        from courses c join course_coaches cc on cc.course_id = c.id join me on cc.coach_person_id = me.pid
        left join course_validation v on v.course_id = c.id and v.coach_person_id = me.pid where to_char(c.course_date, 'YYYY-MM') = p_ym), 0),
    'coach_total', coalesce((select count(*) from courses c join course_coaches cc on cc.course_id = c.id join me on cc.coach_person_id = me.pid where to_char(c.course_date, 'YYYY-MM') = p_ym), 0),
    'prof_hours', coalesce((select sum(case when vstatus='present' then coalesce(vhours,4) when complete then 4 else 0 end) from pd), 0),
    'prof_val', coalesce((select count(*) filter (where vstatus='present' or complete) from pd), 0),
    'prof_total', coalesce((select count(*) from pd), 0)
  );
$$;
