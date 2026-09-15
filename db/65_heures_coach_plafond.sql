-- 65_heures_coach_plafond.sql
-- Heures des coachs sur un cours détaillé (blocs) : plafonnées à la durée de la séance.
-- Un coach présent dans deux blocs en parallèle gère deux groupes en même temps :
-- il n'est pas payé double. Mêmes corps que les fonctions existantes (migrations 09/36/40),
-- seule l'expression « sum(minutes) » devient « least(sum(minutes), durée de la séance) ».
-- Fonction utilitaire pour ne pas répéter l'expression.

create or replace function public.coach_segment_minutes(p_course uuid, p_coach uuid)
returns numeric language sql stable security definer set search_path to 'public' as $$
  select least(
    coalesce((select sum(s.minutes) from course_segments s where s.course_id = p_course and s.coach_person_id = p_coach), 0),
    coalesce((select extract(epoch from (c.end_time - c.start_time)) / 60.0 from courses c where c.id = p_course), 0)
  );
$$;
revoke all on function public.coach_segment_minutes(uuid, uuid) from public, anon;
grant execute on function public.coach_segment_minutes(uuid, uuid) to authenticated;

create or replace function public.staff_hours_month_brut(p_ym text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
with coach_h as (
  select cc.coach_person_id as pid,
    round(sum(case
        when course_is_detailed(c.id)
          then coach_segment_minutes(c.id, cc.coach_person_id) / 60.0
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
      'standing_order', pe.standing_order,
      'by_invoice', coalesce(pe.pays_by_invoice, false),
      'extra', (select s.extra from salary_slips s where s.person_id = ch.pid and s.ym = p_ym)
    ) order by pe.last_name) from coach_all ch join people pe on pe.id = ch.pid), '[]'::jsonb),
  'profs', coalesce((select jsonb_agg(jsonb_build_object(
      'person_id', ph.pid, 'name', pe.first_name || ' ' || pe.last_name, 'iban', pe.iban,
      'days', ph.val_days, 'total_days', ph.total_days, 'hours', ph.hours,
      'standing_order', pe.standing_order,
      'by_invoice', coalesce(pe.pays_by_invoice, false),
      'extra', (select s.extra from salary_slips s where s.person_id = ph.pid and s.ym = p_ym)
    ) order by pe.last_name) from prof_h ph join people pe on pe.id = ph.pid), '[]'::jsonb)
);
$$;

create or replace function public.my_hours_month(p_ym text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
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
            then coach_segment_minutes(c.id, me.pid) / 60.0
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

create or replace function public.person_pay_season(p_person uuid, p_from date, p_to date)
returns table(ym text, coach_hours numeric, coach_courses bigint, coach_total bigint, prof_hours numeric, prof_days bigint, rate numeric, salary numeric, extra numeric, net numeric)
language sql stable security definer set search_path to 'public' as $$
  with months as (
    select to_char(d, 'YYYY-MM') as ym from generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month') d
    where d >= date_trunc('month', p_from) and d <= p_to
  ),
  coach_h as (
    select to_char(c.course_date, 'YYYY-MM') as ym,
      round(sum(case
          when course_is_detailed(c.id)
            then coach_segment_minutes(c.id, p_person) / 60.0
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
