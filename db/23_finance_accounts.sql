-- 23_finance_accounts.sql
-- Deux comptes a debiter (2 assos) + choix par facture. pain.001 genere un PmtInf par compte.
-- (Remplace l'usage de finance_config comme debiteur unique.)
create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null, iban text not null,
  addr_line1 text, addr_line2 text,
  is_default boolean not null default false, sort int default 0
);
alter table public.finance_accounts enable row level security;
drop policy if exists finacct_finance on public.finance_accounts;
create policy finacct_finance on public.finance_accounts for all
  using (can_finance(auth.uid())) with check (can_finance(auth.uid()));
grant select, insert, update, delete on public.finance_accounts to authenticated;

insert into public.finance_accounts (name, iban, addr_line1, addr_line2, is_default, sort)
select * from (values
  ('Association Team Lausanne Tennis', 'CH0609000000166425848', 'CP 106', '1000 Lausanne 18', true, 1),
  ('Association Lausanne Open Tennis', 'CH9209000000168985100', 'CP 106', '1000 Lausanne 18', false, 2)
) v(name, iban, a1, a2, isd, srt)
where not exists (select 1 from public.finance_accounts);

alter table public.invoices add column if not exists debtor_account_id uuid references public.finance_accounts(id);

-- Statut 'en_paiement' (facture incluse dans un pain.001) : status reste un text libre,
-- valeurs : a_valider | validee | en_paiement | payee.
