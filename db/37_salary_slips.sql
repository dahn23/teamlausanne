-- 37_salary_slips.sql
-- Fiches de salaire : la fiduciaire renvoie un PDF (une page par personne, « Montant versé » = net).
-- La console (Heures) lit ce PDF (depuis le mail ou un fichier), découpe la page de chaque personne dans
-- le bucket privé 'salaries' (<person_id>/<YYYY-MM>.pdf) et enregistre le net à payer (éditable).
-- « Valider les salaires » crée une facture à payer par personne (créancier = la personne, son IBAN).
-- Accès : finance (admin/superadmin + tag finance) en écriture ; chaque personne lit UNIQUEMENT ses propres fiches.
create table if not exists public.salary_slips (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  ym text not null check (ym ~ '^\d{4}-\d{2}$'),
  net numeric(12,2), gross numeric(12,2),
  pdf_path text,
  source text not null default 'manual',          -- 'manual' | 'fiduciaire'
  mail_id uuid references public.mail_messages(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (person_id, ym)
);
create index if not exists salary_slips_ym_idx on public.salary_slips(ym);
alter table public.salary_slips enable row level security;
drop policy if exists sal_finance on public.salary_slips;
create policy sal_finance on public.salary_slips for all
  using (can_finance(auth.uid())) with check (can_finance(auth.uid()));
drop policy if exists sal_self on public.salary_slips;
create policy sal_self on public.salary_slips for select
  using (exists (select 1 from profiles pr where pr.user_id = auth.uid() and pr.person_id = salary_slips.person_id));
grant select, insert, update, delete on public.salary_slips to authenticated;

-- Bucket privé : chemin = <person_id>/<YYYY-MM>.pdf → une personne ne voit que son dossier.
insert into storage.buckets (id, name, public) values ('salaries', 'salaries', false) on conflict (id) do nothing;
drop policy if exists salaries_finance on storage.objects;
create policy salaries_finance on storage.objects for all
  using (bucket_id = 'salaries' and can_finance(auth.uid()))
  with check (bucket_id = 'salaries' and can_finance(auth.uid()));
drop policy if exists salaries_self on storage.objects;
create policy salaries_self on storage.objects for select
  using (bucket_id = 'salaries' and exists (select 1 from profiles pr where pr.user_id = auth.uid()
         and pr.person_id::text = (storage.foldername(name))[1]));

-- Valider les salaires d'un mois : une facture à payer par fiche (net > 0) pas encore transmise.
-- Statut 'validee' si la personne a un IBAN (prête pour le pain.001), sinon 'a_valider' (à compléter).
create or replace function public.salary_validate(p_ym text, p_label text)
returns integer language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0; v_acct uuid; v_inv uuid;
begin
  if not can_finance(auth.uid()) then raise exception 'Accès refusé'; end if;
  select id into v_acct from finance_accounts order by is_default desc nulls last, sort limit 1;
  for r in select s.id, s.net, pe.first_name, pe.last_name, nullif(trim(pe.iban),'') as iban
           from salary_slips s join people pe on pe.id = s.person_id
           where s.ym = p_ym and s.invoice_id is null and s.net is not null and s.net > 0 loop
    insert into invoices(source, created_by, creditor_name, creditor_iban, amount, currency, explanation, status,
                         validated_at, validated_by, debtor_account_id)
    values ('salaire', auth.uid(), r.first_name || ' ' || r.last_name, r.iban, r.net, 'CHF', p_label,
            case when r.iban is not null then 'validee' else 'a_valider' end,
            case when r.iban is not null then now() end, case when r.iban is not null then auth.uid() end, v_acct)
    returning id into v_inv;
    update salary_slips set invoice_id = v_inv, updated_at = now(), updated_by = auth.uid() where id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;$$;
grant execute on function public.salary_validate(text, text) to authenticated;
