-- Heures compensées sur facture — Talia Picci (28.09.2026)
--
-- Un cas qui n'existait pas encore : quelqu'un qui TRAVAILLE pour l'académie
-- (6 h de cours par semaine + 4 camps sur l'année scolaire) et qu'on ne paie
-- PAS, parce que ce travail est déduit de sa propre facture d'élève. Sa mère
-- règle un forfait mensuel qui tient déjà compte de la déduction.
--
-- Les trois états existants disaient tous autre chose :
--   · tarif horaire   → elle serait payée à l'heure, ce qu'on ne veut pas ;
--   · salary_monthly  → elle recevrait un salaire fixe, non plus ;
--   · pays_by_invoice → la console lui réclamerait une facture chaque mois,
--     alors qu'elle ne doit JAMAIS nous facturer quoi que ce soit.
-- Mettre son tarif à 0 aurait « marché », mais un zéro ne dit rien : dans six
-- mois quelqu'un le prendrait pour un oubli et le corrigerait. D'où un drapeau
-- explicite, qui nomme l'arrangement.
--
-- Ce que le drapeau change : les heures continuent d'être comptées et
-- affichées — c'est tout l'intérêt, on veut garder un œil dessus — mais la
-- personne sort des montants, de la clôture et de l'extrait fiduciaire.

alter table public.people
  add column if not exists pays_in_kind boolean not null default false;

comment on column public.people.pays_in_kind is
  'Travail compensé sur sa propre facture : heures suivies, jamais payées.';

-- Le récapitulatif mensuel transporte le drapeau, pour que la console puisse
-- afficher la ligne sans montant plutôt que de la faire disparaître.
create or replace function public.staff_hours_month_brut(p_ym text)
returns jsonb language sql stable security definer set search_path = public as $fn$
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
      'standing_order', pe.standing_order,
      'by_invoice', coalesce(pe.pays_by_invoice, false),
      'in_kind', coalesce(pe.pays_in_kind, false),
      'extra', (select s.extra from salary_slips s where s.person_id = ph.pid and s.ym = p_ym)
    ) order by pe.last_name) from prof_h ph join people pe on pe.id = ph.pid), '[]'::jsonb)
);
$fn$;

-- Clôture : une personne compensée n'a pas besoin d'un tarif (elle ne sera pas
-- payée), et son montant ne doit pas gonfler le brut du mois. Sans ces deux
-- ajouts, la clôture se bloquerait sur « tarif manquant » ou compterait des
-- francs qui ne sortiront jamais de la banque.
create or replace function public.payroll_close(p_ym text, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v jsonb; v_sans int; v_n int; v_tot numeric;
begin
  if not can_finance(auth.uid()) then raise exception 'Accès refusé'; end if;

  v := staff_hours_month_brut(p_ym);

  select count(*) into v_sans
    from jsonb_array_elements(v->'coaches') c
   where (c->>'rate') is null and (c->>'salary') is null
     and not (c->>'by_invoice')::boolean
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
    from jsonb_array_elements(v->'coaches') c
   where not (c->>'by_invoice')::boolean
     and not coalesce((c->>'in_kind')::boolean, false);

  insert into payroll_months (ym, status, snapshot, n_people, total_gross, closed_at, closed_by, updated_at)
  values (p_ym, 'cloture', v, v_n, v_tot, now(), auth.uid(), now())
  on conflict (ym) do update
    set status = 'cloture', snapshot = excluded.snapshot, n_people = excluded.n_people,
        total_gross = excluded.total_gross, closed_at = now(), closed_by = auth.uid(), updated_at = now();

  return jsonb_build_object('ym', p_ym, 'personnes', v_n, 'brut', v_tot, 'sans_tarif', v_sans);
end; $fn$;

-- Talia Picci : 6 h par semaine + 4 camps sur l'année, compensés par le
-- forfait mensuel de sa mère. Son tarif horaire est retiré — le garder
-- laisserait croire qu'un paiement est prévu.
update public.people set pays_in_kind = true
 where id = '90b710a7-3f62-425d-9e98-1551fc239471';
delete from public.coach_rates
 where person_id = '90b710a7-3f62-425d-9e98-1551fc239471';
