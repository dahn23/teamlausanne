-- 34_prof_hours_marked.sql
-- Heures des PROFS (études) : comme pour les coachs, un après-midi compte comme validé si le prof a
-- MARQUÉ les présences ce jour-là (etudes_attendance.marked_by = user du prof, via profiles) OU s'il a
-- validé explicitement (etudes_day_validation.status='present'). Heures = celles saisies, sinon 4 h.
-- (Avant : seule la validation explicite comptait -> profs à 0/N et 0 h alors qu'ils avaient rempli.)
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
    count(*) filter (where ev.status='present' or mk.day_id is not null) as val_days,
    count(*) as total_days,
    coalesce(sum(case when ev.status='present' then coalesce(ev.hours,4) when mk.day_id is not null then 4 else 0 end),0) as hours
  from etudes_day_profs dp join etudes_days d on d.id = dp.day_id
  left join etudes_day_validation ev on ev.day_id = d.id and ev.prof_person_id = dp.prof_person_id
  left join lateral (select ea.day_id from etudes_attendance ea join profiles pr on pr.user_id = ea.marked_by
                     where ea.day_id = d.id and pr.person_id = dp.prof_person_id limit 1) mk on true
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
    select d.id as day_id, ev.status as vstatus, ev.hours as vhours,
      exists (select 1 from etudes_attendance ea join profiles pr on pr.user_id = ea.marked_by
              where ea.day_id = d.id and pr.person_id = (select pid from me)) as marked
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
    'prof_hours', coalesce((select sum(case when vstatus='present' then coalesce(vhours,4) when marked then 4 else 0 end) from pd), 0),
    'prof_val', coalesce((select count(*) filter (where vstatus='present' or marked) from pd), 0),
    'prof_total', coalesce((select count(*) from pd), 0)
  );
$$;
