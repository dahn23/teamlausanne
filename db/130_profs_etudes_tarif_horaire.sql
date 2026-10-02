-- 130 — Les profs d'études sont payés à l'heure, et ça se voit enfin.
--
-- Constat de Raphael en relisant le décompte de septembre : les profs d'études
-- n'avaient aucun montant. Le tarif manquait, mais le trou était plus profond —
-- même en saisissant un tarif, rien ne serait apparu. Trois maillons manquaient
-- en aval, et les études ayant démarré fin août, personne ne s'en était encore
-- aperçu : septembre est leur premier mois complet.
--
--   1. staff_hours_month_brut ne renvoyait ni 'rate' ni 'salary' pour les
--      profs, seulement jours et heures.
--   2. payroll_close ne parcourait que 'coaches' : les profs n'entraient ni
--      dans le nombre de personnes ni dans le brut total. Le décompte partait
--      chez la fiduciaire avec leurs heures et pas un franc en face.
--   3. Le PDF et le tableau n'avaient ni colonne Tarif ni colonne Montant pour
--      eux (corrigé dans admin.js / admin.html).
--
-- Le tarif vient de la même source que celui des coachs — coach_rates, saisi
-- dans fiche › Rémunération — puisque le sous-onglet s'affiche déjà pour le
-- rôle « prof ». Rien de nouveau à apprendre pour le secrétariat.
--
-- Effet sur septembre 2026 : 16 personnes / 34'564.75 → 21 / 37'524.75.

begin;

-- 37.– brut de l'heure pour les cinq profs d'études, décision de Raphael.
-- Posé seulement pour qui n'a aucun tarif : on n'écrase pas une saisie faite
-- à la main.
insert into coach_rates (person_id, label, chf_per_hour, is_default)
select pe.id, 'Études', 37, true
from people pe
where pe.id in (select distinct prof_person_id from etudes_day_profs)
  and not exists (select 1 from coach_rates cr where cr.person_id = pe.id);

commit;

-- ---------------------------------------------------------------------------
-- staff_hours_month_brut : les profs reçoivent 'rate' et 'salary', comme les
-- coachs. Le reste de la fonction est inchangé.

create or replace function public.staff_hours_month_brut(p_ym text)
returns jsonb language sql stable security definer set search_path to 'public' as $function$
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
  where to_char(c.course_date, 'YYYY-MM') = p_ym and course_counts_standard(c.id)
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
      'rate', (select cr.chf_per_hour from coach_rates cr where cr.person_id = ch.pid order by cr.is_default desc, cr.created_at limit 1),
      'salary', case when pe.salary_from is null or to_char(pe.salary_from, 'YYYY-MM') <= p_ym then pe.salary_monthly end,
      'standing_order', pe.standing_order,
      'by_invoice', coalesce(pe.pays_by_invoice, false),
      'in_kind', coalesce(pe.pays_in_kind, false),
      'extra', (select s.extra from salary_slips s where s.person_id = ch.pid and s.ym = p_ym)
    ) order by pe.last_name) from coach_all ch join people pe on pe.id = ch.pid), '[]'::jsonb),
  'profs', coalesce((select jsonb_agg(jsonb_build_object(
      'person_id', ph.pid, 'name', pe.first_name || ' ' || pe.last_name, 'iban', pe.iban,
      'days', ph.val_days, 'total_days', ph.total_days, 'hours', ph.hours,
      -- Les profs d'études sont payés à l'heure comme les coachs : même source
      -- de tarif (fiche › Rémunération), donc même colonne « rate ».
      'rate', (select cr.chf_per_hour from coach_rates cr where cr.person_id = ph.pid order by cr.is_default desc, cr.created_at limit 1),
      'salary', case when pe.salary_from is null or to_char(pe.salary_from, 'YYYY-MM') <= p_ym then pe.salary_monthly end,
      'standing_order', pe.standing_order,
      'by_invoice', coalesce(pe.pays_by_invoice, false),
      'in_kind', coalesce(pe.pays_in_kind, false),
      'extra', (select s.extra from salary_slips s where s.person_id = ph.pid and s.ym = p_ym)
    ) order by pe.last_name) from prof_h ph join people pe on pe.id = ph.pid), '[]'::jsonb)
);
$function$;

-- ---------------------------------------------------------------------------
-- payroll_close : coachs ET profs, pour le contrôle du tarif manquant comme
-- pour le total.

create or replace function public.payroll_close(p_ym text, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v jsonb; v_sans int; v_n int; v_tot numeric;
begin
  if not can_finance(auth.uid()) then raise exception 'Accès refusé'; end if;

  v := staff_hours_month_brut(p_ym);

  select count(*) into v_sans
    from (select value as c from jsonb_array_elements(v->'coaches')
          union all
          select value from jsonb_array_elements(v->'profs')) t
   where (c->>'rate') is null and (c->>'salary') is null
     and not coalesce((c->>'by_invoice')::boolean, false)
     and not coalesce((c->>'in_kind')::boolean, false)
     and (c->>'hours')::numeric > 0;
  if v_sans > 0 and not p_force then
    raise exception 'tarif_manquant:%', v_sans;
  end if;

  select count(*), coalesce(sum(
           case when (c->>'salary') is not null then (c->>'salary')::numeric
                when (c->>'rate')   is not null then round((c->>'rate')::numeric * (c->>'hours')::numeric, 2)
                else 0 end
           + coalesce((c->>'extra')::numeric, 0)), 0)
    into v_n, v_tot
    from (select value as c from jsonb_array_elements(v->'coaches')
          union all
          select value from jsonb_array_elements(v->'profs')) t
   where not coalesce((c->>'by_invoice')::boolean, false)
     and not coalesce((c->>'in_kind')::boolean, false);

  insert into payroll_months (ym, status, snapshot, n_people, total_gross, closed_at, closed_by, updated_at)
  values (p_ym, 'cloture', v, v_n, v_tot, now(), auth.uid(), now())
  on conflict (ym) do update
    set status = 'cloture', snapshot = excluded.snapshot, n_people = excluded.n_people,
        total_gross = excluded.total_gross, closed_at = now(), closed_by = auth.uid(), updated_at = now();

  return jsonb_build_object('ym', p_ym, 'personnes', v_n, 'brut', v_tot, 'sans_tarif', v_sans);
end; $function$;
