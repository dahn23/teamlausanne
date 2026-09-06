-- 44_out_invoices.sql
-- Factures ÉMISES (à encaisser) — Phase 2 de la facturation maison.
-- Lot par filière/saison (montant = contrat ÷ échéances, sinon grille Tarifs) → une facture par joueur, numérotée
-- (AAAA-0001), référence SCOR (RF…), PDF QR-facture suisse généré côté navigateur (bucket privé 'out_invoices'),
-- envoi par mail depuis info@, suivi à_envoyer → envoyée → payée (plus tard : rapprochement CAMT par la référence RF).
create table if not exists public.out_invoices (
  id uuid primary key default gen_random_uuid(),
  number text unique not null,
  season_id uuid references public.seasons(id) on delete set null,
  filiere text,
  person_id uuid references public.people(id) on delete set null,          -- joueur facturé
  debtor_person_id uuid references public.people(id) on delete set null,   -- destinataire (parent ou joueur)
  debtor_name text, debtor_street text, debtor_zip text, debtor_city text, debtor_email text,
  label text, instalment_no int, instalment_total int,
  amount numeric(12,2) not null, currency text not null default 'CHF',
  issue_date date not null default current_date, due_date date,
  reference text, account_id uuid references public.finance_accounts(id),
  status text not null default 'a_envoyer',        -- a_envoyer | envoyee | payee | annulee
  sent_at timestamptz, paid_at timestamptz, pdf_path text, note text,
  created_by uuid, created_at timestamptz not null default now()
);
create index if not exists out_invoices_status_idx on public.out_invoices(status, created_at desc);
create index if not exists out_invoices_person_idx on public.out_invoices(person_id);
alter table public.out_invoices enable row level security;
drop policy if exists oi_finance on public.out_invoices;
create policy oi_finance on public.out_invoices for all
  using (can_finance(auth.uid())) with check (can_finance(auth.uid()));
grant select, insert, update, delete on public.out_invoices to authenticated;

insert into storage.buckets (id, name, public) values ('out_invoices', 'out_invoices', false) on conflict (id) do nothing;
drop policy if exists out_invoices_obj on storage.objects;
create policy out_invoices_obj on storage.objects for all
  using (bucket_id = 'out_invoices' and can_finance(auth.uid()))
  with check (bucket_id = 'out_invoices' and can_finance(auth.uid()));

-- Prochain numéro de facture : AAAA-0001, AAAA-0002… (verrou pour éviter les doublons en lot)
create or replace function public.out_invoice_next_number()
returns text language plpgsql security definer set search_path = public as $$
declare v_year text := to_char(current_date, 'YYYY'); v_seq int;
begin
  if not can_finance(auth.uid()) then raise exception 'Accès refusé'; end if;
  perform pg_advisory_xact_lock(hashtext('out_invoice_number'));
  select coalesce(max(substring(number from 6)::int), 0) + 1 into v_seq
    from out_invoices where number like v_year || '-%' and substring(number from 6) ~ '^\d+$';
  return v_year || '-' || lpad(v_seq::text, 4, '0');
end;$$;
grant execute on function public.out_invoice_next_number() to authenticated;
