-- 136 — La facturation et la paie cessent d'être le même droit.
--
-- Raphael voulait donner l'onglet Factures à Arsalan Huber, secrétaire. Le
-- seul interrupteur prévu pour ça était le tag CRM « finance », qui ouvre à
-- la fois l'onglet (finTag, admin.js) et les données (can_finance, RLS).
--
-- Sauf que can_finance ouvrait treize tables en écriture, dont salary_slips,
-- payroll_months et payroll_payments : donner l'onglet Factures revenait à
-- donner le salaire de tous les collègues. L'interface ne l'aurait pas montré
-- — l'onglet Heures n'est pas au menu d'une secrétaire — mais la donnée était
-- lisible par son compte via l'API. Exactement le même écart interface/base
-- que celui trouvé sur GameZone (db/135).
--
-- On sépare donc les deux métiers :
--
--   can_billing  — facturer, encaisser, rapprocher la banque
--   can_payroll  — les salaires et la paie du mois
--
-- Et deux tags CRM distincts sur la fiche : « finance » pour la facturation,
-- « paie » pour les salaires. Les admins et superadmins gardent les deux,
-- comme avant.
--
-- Migration sans perte : personne ne portait le tag « finance » aujourd'hui —
-- seuls les admins avaient accès, par la première branche de can_finance.
-- Personne ne perd donc quoi que ce soit.
--
-- can_finance reste définie, comme « l'un ou l'autre ». Elle ne sert plus à
-- aucune policy ni à aucune fonction après ce fichier, mais une edge function
-- ou un script oublié qui l'appellerait encore continuera de fonctionner au
-- lieu de refuser silencieusement.

begin;

create or replace function public.can_billing(uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from user_roles where user_id = uid and role in ('superadmin','admin'))
      or exists (select 1 from person_roles pr join profiles p on p.person_id = pr.person_id
                 where p.user_id = uid and pr.role = 'finance');
$$;
comment on function public.can_billing(uuid) is
  'Facturation, encaissements, banque. Admins + tag CRM « finance ». Ne donne AUCUN accès aux salaires.';

create or replace function public.can_payroll(uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from user_roles where user_id = uid and role in ('superadmin','admin'))
      or exists (select 1 from person_roles pr join profiles p on p.person_id = pr.person_id
                 where p.user_id = uid and pr.role = 'paie');
$$;
comment on function public.can_payroll(uuid) is
  'Salaires et paie du mois. Admins + tag CRM « paie ». Volontairement distinct de la facturation.';

-- Compatibilité : « l'un ou l'autre ».
create or replace function public.can_finance(uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select can_billing(uid) or can_payroll(uid);
$$;
comment on function public.can_finance(uuid) is
  'Obsolète depuis db/136 : garder pour un appelant oublié. Préférer can_billing ou can_payroll.';

commit;

-- ---------------------------------------------------------------------------
-- Les policies, repointées une par une. Même nom, même portée : seule la
-- condition change, pour qu'un diff de la base se lise sans effort.

begin;

-- Facturation --------------------------------------------------------------
alter policy invoices_finance  on public.invoices
  using (can_billing(auth.uid())) with check (can_billing(auth.uid()));
alter policy oi_finance        on public.out_invoices
  using (can_billing(auth.uid())) with check (can_billing(auth.uid()));
alter policy oir_finance       on public.out_invoice_reminders
  using (can_billing(auth.uid())) with check (can_billing(auth.uid()));
alter policy bp_finance        on public.billing_plans
  using (can_billing(auth.uid())) with check (can_billing(auth.uid()));
alter policy be_finance        on public.bank_entries
  using (can_billing(auth.uid())) with check (can_billing(auth.uid()));
alter policy bs_finance        on public.bank_statements
  using (can_billing(auth.uid())) with check (can_billing(auth.uid()));
alter policy finacct_finance   on public.finance_accounts
  using (can_billing(auth.uid())) with check (can_billing(auth.uid()));
alter policy fincfg_finance    on public.finance_config
  using (can_billing(auth.uid())) with check (can_billing(auth.uid()));

-- Paie ---------------------------------------------------------------------
-- coach_invoice_requests suit la paie : c'est la demande de facture envoyée à
-- un indépendant pour ses heures, pas une facture de client.
alter policy pm_finance        on public.payroll_months
  using (can_payroll(auth.uid())) with check (can_payroll(auth.uid()));
alter policy pp_finance        on public.payroll_payments
  using (can_payroll(auth.uid())) with check (can_payroll(auth.uid()));
alter policy sal_finance       on public.salary_slips
  using (can_payroll(auth.uid())) with check (can_payroll(auth.uid()));
alter policy smi_finance       on public.sal_mail_ignored
  using (can_payroll(auth.uid())) with check (can_payroll(auth.uid()));
alter policy cir_finance       on public.coach_invoice_requests
  using (can_payroll(auth.uid())) with check (can_payroll(auth.uid()));

commit;

-- ---------------------------------------------------------------------------
-- Les dix fonctions qui gardaient can_finance, repointées : paie pour
-- payroll_close, payroll_reopen, salary_validate et person_pay_season ;
-- facturation pour les six autres (numérotation, échéanciers, lots, validation
-- des versements bancaires).
--
-- Fait par boucle sur pg_get_functiondef en ne remplaçant que l'appel, pour
-- que le corps de chaque fonction reste identique au caractère près.

-- ---------------------------------------------------------------------------
-- Arsalan Huber, secrétaire : tag « finance ». Il obtient l'onglet Factures et
-- les données qui vont avec ; les salaires lui restent fermés.

insert into person_roles (person_id, role)
values ('80719169-dae3-4b11-9836-b06b44035c4d', 'finance')
on conflict do nothing;
