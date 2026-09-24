-- Paie — clôture du mois (24.09.2026)
--
-- Tout le circuit de paie existait déjà : heures par coach, tarif horaire,
-- décompte PDF envoyé à la fiduciaire, retour des nets lu depuis le mail,
-- factures à payer, fichier pain.001 pour PostFinance, fiche de salaire visible
-- par le coach. Il manquait la pièce qui tient l'ensemble : un mois arrêté.
--
-- Sans clôture, les heures continuent de bouger après l'envoi du décompte — un
-- cours validé en retard, une présence corrigée — et les nets que renvoie la
-- fiduciaire ne correspondent plus à rien de conservé. On ne peut ni vérifier
-- son travail, ni justifier un paiement six mois plus tard.
--
-- D'où l'instantané : à la clôture on fige, pour chaque personne, les heures,
-- le tarif et le brut tels qu'ils étaient. Le décompte part de cet instantané,
-- le retour de la fiduciaire s'y compare, et l'écran signale si les heures
-- vivantes ont bougé depuis — sans rien réécrire tout seul.
--
-- Le mois reste réouvrable : on se trompe, et il faut pouvoir corriger sans
-- passer par du SQL à la main. Réouvrir efface l'instantané, qui sera refait à
-- la clôture suivante.

create table if not exists public.payroll_months (
  ym          text primary key,                  -- 'AAAA-MM'
  status      text not null default 'ouvert',    -- ouvert | cloture | envoye | retour | paye
  snapshot    jsonb,                             -- heures/tarifs/brut figés à la clôture
  n_people    int,
  total_gross numeric(12,2),
  closed_at   timestamptz, closed_by uuid,
  sent_at     timestamptz, sent_by uuid,         -- décompte parti à la fiduciaire
  paid_at     timestamptz, paid_by uuid,         -- pain.001 déposé et paiements partis
  note        text,
  updated_at  timestamptz not null default now()
);

alter table public.payroll_months enable row level security;

-- Mêmes droits que les salaires : admin, superadmin, ou tag « finance ».
drop policy if exists pm_finance on public.payroll_months;
create policy pm_finance on public.payroll_months for all
  using (can_finance(auth.uid())) with check (can_finance(auth.uid()));
grant select, insert, update, delete on public.payroll_months to authenticated;

-- Clôturer : fige l'instantané. Refuse si des heures existent sans tarif, car
-- un décompte à zéro pour quelqu'un qui a travaillé est une erreur silencieuse
-- que personne ne rattrape avant la fin du mois suivant.
create or replace function public.payroll_close(p_ym text, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb; v_sans int; v_n int; v_tot numeric;
begin
  if not can_finance(auth.uid()) then raise exception 'Accès refusé'; end if;

  v := staff_hours_month_brut(p_ym);

  select count(*) into v_sans
    from jsonb_array_elements(v->'coaches') c
   where (c->>'rate') is null and (c->>'salary') is null
     and not (c->>'by_invoice')::boolean and (c->>'hours')::numeric > 0;
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
   where not (c->>'by_invoice')::boolean;

  insert into payroll_months (ym, status, snapshot, n_people, total_gross, closed_at, closed_by, updated_at)
  values (p_ym, 'cloture', v, v_n, v_tot, now(), auth.uid(), now())
  on conflict (ym) do update
    set status = 'cloture', snapshot = excluded.snapshot, n_people = excluded.n_people,
        total_gross = excluded.total_gross, closed_at = now(), closed_by = auth.uid(), updated_at = now();

  return jsonb_build_object('ym', p_ym, 'personnes', v_n, 'brut', v_tot, 'sans_tarif', v_sans);
end; $$;

create or replace function public.payroll_reopen(p_ym text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_finance(auth.uid()) then raise exception 'Accès refusé'; end if;
  update payroll_months
     set status = 'ouvert', snapshot = null, n_people = null, total_gross = null,
         closed_at = null, closed_by = null, sent_at = null, sent_by = null, updated_at = now()
   where ym = p_ym;
end; $$;

-- Ce qui a bougé depuis la clôture : on compare l'instantané aux heures
-- vivantes. Rien n'est réécrit — on signale, l'humain décide de rouvrir ou non.
create or replace function public.payroll_drift(p_ym text)
returns table (person_id uuid, nom text, heures_figees numeric, heures_actuelles numeric)
language sql stable security definer set search_path = public as $$
  with fige as (
    select (c->>'person_id')::uuid as pid, c->>'name' as nom, (c->>'hours')::numeric as h
      from payroll_months m, jsonb_array_elements(m.snapshot->'coaches') c
     where m.ym = p_ym and m.snapshot is not null),
  vivant as (
    select (c->>'person_id')::uuid as pid, (c->>'hours')::numeric as h
      from jsonb_array_elements(staff_hours_month_brut(p_ym)->'coaches') c)
  select f.pid, f.nom, f.h, coalesce(v.h, 0)
    from fige f left join vivant v on v.pid = f.pid
   where coalesce(v.h, 0) <> f.h;
$$;

revoke all on function public.payroll_close(text, boolean) from public, anon;
revoke all on function public.payroll_reopen(text)          from public, anon;
revoke all on function public.payroll_drift(text)           from public, anon;
grant execute on function public.payroll_close(text, boolean) to authenticated;
grant execute on function public.payroll_reopen(text)         to authenticated;
grant execute on function public.payroll_drift(text)          to authenticated;
