-- Relevés bancaires — rapprochement des paiements reçus (24.09.2026)
--
-- On importe le relevé PostFinance, on rapproche chaque versement d'une facture
-- émise, et c'est la VALIDATION qui marque la facture payée. Jamais l'import :
-- un rapprochement automatique qui se trompe encaisse une facture qui ne l'est
-- pas, et la famille ne reçoit plus de rappel. On préfère une ligne « à
-- vérifier » à une facture faussement payée.
--
-- La référence QR (SCOR, RF…) est le seul lien vraiment fiable : elle est
-- unique par facture et voyage avec le paiement. Le montant et le nom ne
-- servent que de repli, et ce repli n'est jamais validé tout seul.
--
-- Deux formats à l'entrée : le PDF du relevé (ce qu'on a sous la main) et le
-- camt.053 (XML, le format bancaire fait pour ça). Le second est exact, le
-- premier dépend d'une mise en page. La table ne connaît ni l'un ni l'autre :
-- elle ne stocke que le résultat de la lecture, plus la ligne brute pour qu'on
-- puisse toujours vérifier ce qui a été lu.

create table if not exists public.bank_statements (
  id           uuid primary key default gen_random_uuid(),
  source       text not null default 'postfinance',
  format       text not null,                     -- 'pdf' | 'camt053'
  filename     text,
  period_from  date,
  period_to    date,
  n_entries    int  not null default 0,
  total_credit numeric(12,2) not null default 0,
  imported_at  timestamptz not null default now(),
  imported_by  uuid
);

create table if not exists public.bank_entries (
  id            uuid primary key default gen_random_uuid(),
  statement_id  uuid references public.bank_statements(id) on delete cascade,
  value_date    date,
  amount        numeric(12,2) not null,
  currency      text not null default 'CHF',
  reference     text,                             -- SCOR (RF…), sans espaces
  debtor_name   text,
  communication text,
  raw           text,                             -- la ligne telle qu'elle a été lue
  -- Empreinte anti-doublon : réimporter le même relevé ne doit pas encaisser
  -- deux fois. Calculée à la lecture (date + montant + référence + libellé).
  fingerprint   text unique,
  invoice_id    uuid references public.out_invoices(id) on delete set null,
  match_kind    text,                             -- 'reference' | 'montant_nom' | 'manuel' | null
  status        text not null default 'a_valider',-- 'a_valider' | 'valide' | 'ignore'
  validated_at  timestamptz, validated_by uuid,
  created_at    timestamptz not null default now()
);
create index if not exists bank_entries_statement_idx on public.bank_entries (statement_id);
create index if not exists bank_entries_status_idx    on public.bank_entries (status);
create index if not exists bank_entries_invoice_idx   on public.bank_entries (invoice_id);

-- Rappels envoyés pour une facture en retard : sans trace, on relance deux fois
-- la même famille le même jour, ou personne pendant un mois.
create table if not exists public.out_invoice_reminders (
  id         uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.out_invoices(id) on delete cascade,
  level      int  not null default 1,             -- 1er rappel, 2e, …
  to_email   text,
  sent_at    timestamptz not null default now(),
  sent_by    uuid
);
create index if not exists oir_invoice_idx on public.out_invoice_reminders (invoice_id);

alter table public.bank_statements       enable row level security;
alter table public.bank_entries          enable row level security;
alter table public.out_invoice_reminders enable row level security;

-- Mêmes droits que les factures : ces tables nomment des familles et des
-- montants, elles suivent l'onglet Factures et personne d'autre.
drop policy if exists bs_finance on public.bank_statements;
create policy bs_finance on public.bank_statements for all
  using (can_finance(auth.uid())) with check (can_finance(auth.uid()));
drop policy if exists be_finance on public.bank_entries;
create policy be_finance on public.bank_entries for all
  using (can_finance(auth.uid())) with check (can_finance(auth.uid()));
drop policy if exists oir_finance on public.out_invoice_reminders;
create policy oir_finance on public.out_invoice_reminders for all
  using (can_finance(auth.uid())) with check (can_finance(auth.uid()));

grant select, insert, update, delete on public.bank_statements       to authenticated;
grant select, insert, update, delete on public.bank_entries          to authenticated;
grant select, insert, update, delete on public.out_invoice_reminders to authenticated;

-- Valider un versement : la facture passe payée, à la date de valeur du
-- versement et non à celle du clic — c'est la date à laquelle l'argent est
-- arrivé qui compte pour la comptabilité.
-- Midi et non minuit : minuit+02 repasse la veille une fois converti en UTC.
create or replace function public.bank_entry_valider(p_entry uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if not can_finance(auth.uid()) then raise exception 'Accès refusé'; end if;
  select * into v from bank_entries where id = p_entry;
  if v is null then raise exception 'Versement introuvable'; end if;
  if v.invoice_id is null then raise exception 'Ce versement n''est rattaché à aucune facture'; end if;

  update out_invoices
     set status  = 'payee',
         paid_at = (coalesce(v.value_date, current_date)::text || ' 12:00:00+02')::timestamptz
   where id = v.invoice_id;

  update bank_entries
     set status = 'valide', validated_at = now(), validated_by = auth.uid()
   where id = p_entry;
end; $$;

-- Annuler une validation : on se trompe, et il faut pouvoir revenir en arrière
-- sans passer par du SQL à la main.
create or replace function public.bank_entry_devalider(p_entry uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if not can_finance(auth.uid()) then raise exception 'Accès refusé'; end if;
  select * into v from bank_entries where id = p_entry;
  if v is null then raise exception 'Versement introuvable'; end if;
  if v.invoice_id is not null then
    update out_invoices set status = 'envoyee', paid_at = null
     where id = v.invoice_id and status = 'payee';
  end if;
  update bank_entries set status = 'a_valider', validated_at = null, validated_by = null
   where id = p_entry;
end; $$;

revoke all on function public.bank_entry_valider(uuid)    from public, anon;
revoke all on function public.bank_entry_devalider(uuid)  from public, anon;
grant execute on function public.bank_entry_valider(uuid)   to authenticated;
grant execute on function public.bank_entry_devalider(uuid) to authenticated;
