-- 22_finance_config.sql
-- Compte a debiter (le notre) pour generer le fichier de paiement ISO 20022 pain.001
-- depose ensuite dans PostFinance e-finance (verification + signature manuelle).
create table if not exists public.finance_config (
  id int primary key default 1,
  debtor_name text, debtor_iban text,
  updated_at timestamptz default now(),
  constraint finance_config_single check (id = 1)
);
alter table public.finance_config enable row level security;
drop policy if exists fincfg_finance on public.finance_config;
create policy fincfg_finance on public.finance_config for all
  using (can_finance(auth.uid())) with check (can_finance(auth.uid()));
grant select, insert, update on public.finance_config to authenticated;
insert into public.finance_config (id) values (1) on conflict (id) do nothing;
