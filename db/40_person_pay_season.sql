-- 40_person_pay_season.sql
-- Fiche › Coach › « Rémunération versée » : détail mensuel d'une personne sur une période (saison) :
-- heures de cours validées × tarif par défaut, heures études (profs), salaire brut mensuel, extra, net.
-- Accès : finance (admin/superadmin + tag finance).
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
         (select pe.salary_monthly from people pe where pe.id = p_person),
         s.extra, s.net
  from months m
  left join coach_h ch on ch.ym = m.ym
  left join prof_h ph on ph.ym = m.ym
  left join salary_slips s on s.person_id = p_person and s.ym = m.ym
  where can_finance(auth.uid())
  order by m.ym;
$$;
grant execute on function public.person_pay_season(uuid, date, date) to authenticated;
