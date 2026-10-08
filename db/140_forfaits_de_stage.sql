-- 140 — Les forfaits de stage entrent dans la paie.
--
-- Constat du 08.10.2026. L'encadrement des stages se paie au FORFAIT, pas à
-- l'heure : un montant par coach et par camp, selon son expérience. Le champ
-- existait (stage_staff.fee) mais trois choses manquaient.
--
-- 1. Il n'était relié à rien. Aucune fonction de la base ne lisait
--    stage_staff : le montant ne servait qu'à soustraire dans le résumé du
--    camp. Il ne partait ni dans l'onglet Heures, ni dans le décompte de la
--    fiduciaire.
--
-- 2. Les semaines de stage n'ont aucun cours. L'école ferme pendant les
--    camps — zéro ligne dans « courses » du 12 au 23 octobre. Les heures de
--    la paie venant des cours, Célyan, Mathieu et Yann auraient affiché zéro
--    heure pour cette quinzaine et touché zéro franc.
--
-- 3. Les cinq affectations étaient à 0.— : personne n'avait rien à saisir,
--    puisque rien n'en dépendait.
--
-- Deux ajouts :
--
-- · people.stage_fee — le forfait habituel d'un coach, posé sur sa fiche.
--   « Selon le coach et son expérience » : c'est une propriété de la
--   personne, pas du camp. Il sert de valeur par défaut quand on l'ajoute à
--   un stage, et reste modifiable camp par camp.
--
-- · staff_hours_month_brut renvoie « stage_fee » et « stages » par coach, et
--   payroll_close les ajoute au brut du mois.
--
-- UN FORFAIT PAR COACH ET PAR CAMP, pas par catégorie. stage_staff a une
-- ligne par (session, catégorie) : Célyan Lorival encadre le Loisir journée
-- ET le Loisir matin de la semaine 1, donc deux lignes. On prend donc le plus
-- élevé des montants saisis pour un même camp, et non leur somme — si le même
-- forfait est noté sur les deux lignes, il n'est payé qu'une fois. Un coach
-- qui fait réellement deux camps a deux sessions, donc deux forfaits. Même
-- piège que pour les repas (db/139), même parade.
--
-- Le mois d'un camp est celui de sa date de DÉBUT : un camp à cheval sur deux
-- mois se paie en entier avec celui qui le commence, plutôt que de couper un
-- forfait en deux.

begin;

alter table public.people
  add column if not exists stage_fee numeric;

comment on column public.people.stage_fee is
  'Forfait habituel pour encadrer une semaine de stage. Valeur par défaut à l''ajout sur un camp ; le montant réel vit dans stage_staff.fee.';

commit;

-- ---------------------------------------------------------------------------

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
-- Forfaits de stage du mois. Le max par camp, jamais la somme : voir l'entête.
stage_f as (
  select pid, sum(f) as stage_fee, count(*) as n_stages
  from (
    select ss.coach_person_id as pid, ss.session_id, max(coalesce(ss.fee, 0)) as f
      from stage_staff ss join stage_sessions s on s.id = ss.session_id
     where to_char(s.start_date, 'YYYY-MM') = p_ym and ss.coach_person_id is not null
     group by ss.coach_person_id, ss.session_id
  ) t
  where f > 0
  group by pid
),
coach_all as (
  select pid, hours, n_val, n_total from coach_h
  union
  select pe.id, 0::numeric, 0::bigint, 0::bigint from people pe
  where pe.salary_monthly is not null and coalesce(pe.is_active, true)
    and (pe.salary_from is null or to_char(pe.salary_from, 'YYYY-MM') <= p_ym)
    and pe.id not in (select pid from coach_h)
  union
  -- Un coach qui n'a QUE des stages ce mois-là doit tout de même paraître :
  -- sans ça, une quinzaine de camps le ferait disparaître du décompte.
  select sf.pid, 0::numeric, 0::bigint, 0::bigint from stage_f sf
  where sf.pid not in (select pid from coach_h)
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
      'stage_fee', (select sf.stage_fee from stage_f sf where sf.pid = ch.pid),
      'stages', (select sf.n_stages from stage_f sf where sf.pid = ch.pid),
      'extra', (select s.extra from salary_slips s where s.person_id = ch.pid and s.ym = p_ym)
    ) order by pe.last_name) from coach_all ch join people pe on pe.id = ch.pid), '[]'::jsonb),
  'profs', coalesce((select jsonb_agg(jsonb_build_object(
      'person_id', ph.pid, 'name', pe.first_name || ' ' || pe.last_name, 'iban', pe.iban,
      'days', ph.val_days, 'total_days', ph.total_days, 'hours', ph.hours,
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
-- payroll_close : le forfait de stage s'ajoute au brut, comme l'extra.
-- Le contrôle du tarif manquant ne le réclame pas : un coach qui n'a fait
-- qu'un stage n'a pas besoin de tarif horaire pour être payé.

create or replace function public.payroll_close(p_ym text, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v jsonb; v_sans int; v_n int; v_tot numeric;
begin
  if not can_payroll(auth.uid()) then raise exception 'Accès refusé'; end if;

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
           + coalesce((c->>'stage_fee')::numeric, 0)
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
