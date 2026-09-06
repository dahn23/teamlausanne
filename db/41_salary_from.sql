-- 41_salary_from.sql
-- people.salary_from : date de début du salaire fixe (null = depuis toujours). Un salarié n'apparaît dans Heures
-- (et son salaire n'est compté dans la fiche › Rémunération) qu'à partir du mois de cette date.
-- Arsalan Huber = 2 200 brut, Raphael Vergnaud = 7 916 brut, tous deux dès septembre 2026.
alter table public.people add column if not exists salary_from date;
update public.people set salary_monthly = 2200, salary_from = '2026-09-01' where first_name ilike 'Arsalan%' and last_name ilike 'Huber';
update public.people set salary_monthly = 7916, salary_from = '2026-09-01' where first_name ilike 'Raphael' and last_name ilike 'Vergnaud';

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
coach_all as (
  select pid, hours, n_val, n_total from coach_h
  union all
  select pe.id, 0::numeric, 0::bigint, 0::bigint from people pe
  where pe.salary_monthly is not null and coalesce(pe.is_active, true)
    and (pe.salary_from is null or to_char(pe.salary_from, 'YYYY-MM') <= p_ym)
    and pe.id not in (select pid from coach_h)
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
      'rate', (select cr.chf_per_hour from coach_rates cr where cr.person_id = ch.pid and cr.is_default limit 1),
      'salary', case when pe.salary_from is null or to_char(pe.salary_from, 'YYYY-MM') <= p_ym then pe.salary_monthly end,
      'extra', (select s.extra from salary_slips s where s.person_id = ch.pid and s.ym = p_ym)
    ) order by pe.last_name) from coach_all ch join people pe on pe.id = ch.pid), '[]'::jsonb),
  'profs', coalesce((select jsonb_agg(jsonb_build_object(
      'person_id', ph.pid, 'name', pe.first_name || ' ' || pe.last_name, 'iban', pe.iban,
      'days', ph.val_days, 'total_days', ph.total_days, 'hours', ph.hours,
      'extra', (select s.extra from salary_slips s where s.person_id = ph.pid and s.ym = p_ym)
    ) order by pe.last_name) from prof_h ph join people pe on pe.id = ph.pid), '[]'::jsonb)
);
$$;

create or replace function public.person_pay_season(p_person uuid, p_from date, p_to date)
returns table (ym text, coach_hours numeric, coach_courses bigint, coach_total bigint, prof_hours numeric, prof_days bigint,
               rate numeric, salary numeric, extra numeric, net numeric)
language sql stable security definer set search_path = public as $$
  with months as (
    select to_char(d, 'YYYY-MM') as ym from generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month') d
    where d >= date_trunc('month', p_from) and d <= p_to
  ),
  coach_h as (
    select to_char(c.course_date, 'YYYY-MM') as ym,
      round(sum(case
          when course_is_detailed(c.id)
            then coalesce((select sum(s.minutes) from course_segments s where s.course_id = c.id and s.coach_person_id = p_person), 0) / 60.0
          when exists (select 1 from attendance a where a.course_id = c.id and a.person_id = p_person and a.is_coach and a.status = 'present') or v.course_id is not null
            then extract(epoch from (c.end_time - c.start_time)) / 3600.0
          else 0 end)::numeric, 2) as hours,
      count(*) filter (where case when course_is_detailed(c.id)
          then exists (select 1 from course_segments s where s.course_id = c.id)
          else (exists (select 1 from attendance a where a.course_id = c.id and a.person_id = p_person and a.is_coach and a.status = 'present') or v.course_id is not null) end) as n_val,
      count(*) as n_total
    from courses c join course_coaches cc on cc.course_id = c.id and cc.coach_person_id = p_person
    left join course_validation v on v.course_id = c.id and v.coach_person_id = p_person
    where c.course_date >= date_trunc('month', p_from) and c.course_date <= p_to
    group by 1
  ),
  prof_h as (
    select to_char(d.day, 'YYYY-MM') as ym,
      count(*) filter (where ev.status='present' or etudes_day_complete(d.id)) as val_days,
      coalesce(sum(case when ev.status='present' then coalesce(ev.hours,4) when etudes_day_complete(d.id) then 4 else 0 end),0) as hours
    from etudes_day_profs dp join etudes_days d on d.id = dp.day_id
    left join etudes_day_validation ev on ev.day_id = d.id and ev.prof_person_id = p_person
    where dp.prof_person_id = p_person and d.day >= date_trunc('month', p_from) and d.day <= p_to
    group by 1
  )
  select m.ym, coalesce(ch.hours, 0), coalesce(ch.n_val, 0), coalesce(ch.n_total, 0), coalesce(ph.hours, 0), coalesce(ph.val_days, 0),
         (select cr.chf_per_hour from coach_rates cr where cr.person_id = p_person and cr.is_default limit 1),
         (select case when pe.salary_from is null or to_char(pe.salary_from, 'YYYY-MM') <= m.ym then pe.salary_monthly end from people pe where pe.id = p_person),
         s.extra, s.net
  from months m
  left join coach_h ch on ch.ym = m.ym
  left join prof_h ph on ph.ym = m.ym
  left join salary_slips s on s.person_id = p_person and s.ym = m.ym
  where can_finance(auth.uid())
  order by m.ym;
$$;
