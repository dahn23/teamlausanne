-- 21_invoices.sql
-- Onglet Factures (couche 2 finances). Acces : superadmin/admin + tag CRM "finance".
-- Phase 1 : upload PDF (bucket prive 'invoices'), champs creancier/montant/ref/echeance/
-- explication, statut a_valider->validee->payee, export ZIP fiduciaire.
-- A venir : lecture du QR-facture suisse (montant/IBAN/ref auto), detection dans les mails,
-- generation pain.001 (ISO 20022) pour PostFinance.
create or replace function public.can_finance(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role in ('superadmin','admin'))
      or exists (select 1 from person_roles pr join profiles p on p.person_id = pr.person_id
                 where p.user_id = uid and pr.role = 'finance');
$$;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  source text not null default 'upload',        -- 'upload' | 'mail'
  mail_id uuid references public.mail_messages(id) on delete set null,
  pdf_path text, filename text,
  creditor_name text, creditor_iban text,
  amount numeric(12,2), currency text default 'CHF',
  reference text, qr_message text, qr_raw text,
  explanation text, due_date date,
  status text not null default 'a_valider',      -- 'a_valider' | 'validee' | 'payee'
  validated_at timestamptz, validated_by uuid references auth.users(id),
  paid_at timestamptz, notes text
);
create index if not exists invoices_status_idx on public.invoices(status, created_at desc);
create index if not exists invoices_mail_idx on public.invoices(mail_id);

alter table public.invoices enable row level security;
drop policy if exists invoices_finance on public.invoices;
create policy invoices_finance on public.invoices for all
  using (can_finance(auth.uid())) with check (can_finance(auth.uid()));
grant select, insert, update, delete on public.invoices to authenticated;

insert into storage.buckets (id, name, public) values ('invoices', 'invoices', false)
  on conflict (id) do nothing;
drop policy if exists invoices_obj_all on storage.objects;
create policy invoices_obj_all on storage.objects for all
  using (bucket_id = 'invoices' and can_finance(auth.uid()))
  with check (bucket_id = 'invoices' and can_finance(auth.uid()));
