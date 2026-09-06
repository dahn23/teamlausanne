-- 42_standing_order.sql
-- Ordre permanent : people.standing_order = net mensuel déjà versé par la banque (null = pas d'ordre permanent).
-- « Valider les salaires » ne crée une facture que pour le COMPLÉMENT (net fiduciaire − ordre permanent) > 0
-- (ex. extra du mois). Le net importé reste enregistré tel quel. staff_hours_month renvoie 'standing_order'.
alter table public.people add column if not exists standing_order numeric(12,2);

create or replace function public.salary_validate(p_ym text, p_label text)
returns integer language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0; v_acct uuid; v_inv uuid; v_amt numeric; v_lbl text;
begin
  if not can_finance(auth.uid()) then raise exception 'Accès refusé'; end if;
  select id into v_acct from finance_accounts order by is_default desc nulls last, sort limit 1;
  for r in select s.id, s.net, pe.first_name, pe.last_name, nullif(trim(pe.iban),'') as iban, pe.standing_order
           from salary_slips s join people pe on pe.id = s.person_id
           where s.ym = p_ym and s.invoice_id is null and s.net is not null and s.net > 0 loop
    v_amt := r.net - coalesce(r.standing_order, 0);
    if v_amt <= 0 then continue; end if;            -- couvert par l'ordre permanent : rien à payer
    v_lbl := p_label;
    if r.standing_order is not null then
      v_lbl := 'Complément ' || lower(left(p_label, 1)) || substr(p_label, 2) || ' (net ' || to_char(r.net, 'FM999G999D00') || ' − ordre permanent ' || to_char(r.standing_order, 'FM999G999D00') || ')';
    end if;
    insert into invoices(source, created_by, creditor_name, creditor_iban, amount, currency, explanation, status,
                         validated_at, validated_by, debtor_account_id)
    values ('salaire', auth.uid(), r.first_name || ' ' || r.last_name, r.iban, v_amt, 'CHF', v_lbl,
            case when r.iban is not null then 'validee' else 'a_valider' end,
            case when r.iban is not null then now() end, case when r.iban is not null then auth.uid() end, v_acct)
    returning id into v_inv;
    update salary_slips set invoice_id = v_inv, updated_at = now(), updated_by = auth.uid() where id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;$$;

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
      'standing_order', pe.standing_order,
      'extra', (select s.extra from salary_slips s where s.person_id = ch.pid and s.ym = p_ym)
    ) order by pe.last_name) from coach_all ch join people pe on pe.id = ch.pid), '[]'::jsonb),
  'profs', coalesce((select jsonb_agg(jsonb_build_object(
      'person_id', ph.pid, 'name', pe.first_name || ' ' || pe.last_name, 'iban', pe.iban,
      'days', ph.val_days, 'total_days', ph.total_days, 'hours', ph.hours,
      'standing_order', pe.standing_order,
      'extra', (select s.extra from salary_slips s where s.person_id = ph.pid and s.ym = p_ym)
    ) order by pe.last_name) from prof_h ph join people pe on pe.id = ph.pid), '[]'::jsonb)
);
$$;
