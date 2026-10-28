-- 210_notes_de_frais_groupees.sql
-- Note de frais : plusieurs lignes dans UNE note, donc un seul remboursement.
--
-- Jusqu'ici une dépense = un remboursement. Trois achats dans la semaine
-- faisaient trois virements. Le modèle Excel de Raphaël dit comment ça se
-- passe en vrai : un en-tête (le nom, la période), des lignes datées, un
-- total, un paiement.
--
-- On garde ce qui existe — la dépense reste la ligne, avec son justificatif,
-- son extraction et son statut — et on ajoute au-dessus la NOTE qui les
-- regroupe. `report_id` est facultatif : une dépense isolée reste possible,
-- et les dépenses déjà saisies (aucune à ce jour) ne bougent pas.

create table if not exists public.expense_reports (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  title text not null,
  statut text not null default 'ouverte'
    check (statut in ('ouverte', 'envoyee', 'remboursee')),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid,
  submitted_at timestamptz,
  reimbursed_at timestamptz,
  reimbursed_by uuid
);
create index if not exists expense_reports_person on public.expense_reports(person_id, created_at desc);

alter table public.expenses
  add column if not exists report_id uuid references public.expense_reports(id) on delete set null;
create index if not exists expenses_report on public.expenses(report_id);

-- Mêmes portes que les dépenses : chacun les siennes, et le secrétariat
-- « finance » (Arsalan) voit tout. Volontairement identique à db/200 : deux
-- règles différentes pour la ligne et pour son en-tête seraient intenables.
alter table public.expense_reports enable row level security;

drop policy if exists er_lecture on public.expense_reports;
create policy er_lecture on public.expense_reports for select
  using (person_id = my_person_id() or can_notes_frais_all(auth.uid()));

drop policy if exists er_creation on public.expense_reports;
create policy er_creation on public.expense_reports for insert
  with check ((person_id = my_person_id() and can_notes_frais(auth.uid()))
              or can_notes_frais_all(auth.uid()));

drop policy if exists er_modif on public.expense_reports;
create policy er_modif on public.expense_reports for update
  using (person_id = my_person_id() or can_notes_frais_all(auth.uid()))
  with check (person_id = my_person_id() or can_notes_frais_all(auth.uid()));

drop policy if exists er_suppr on public.expense_reports;
create policy er_suppr on public.expense_reports for delete
  using (person_id = my_person_id() or can_notes_frais_all(auth.uid()));

grant select, insert, update, delete on public.expense_reports to authenticated;

-- Le total d'une note, lu par la console sans tout recalculer à la main.
create or replace view public.expense_reports_totaux
with (security_invoker = true) as
  select r.id, r.person_id, r.title, r.statut, r.created_at, r.submitted_at,
         r.reimbursed_at,
         coalesce(sum(e.amount), 0)::numeric(12,2) as total,
         count(e.id) as lignes,
         count(e.id) filter (where e.pdf_path is null) as sans_justificatif
  from public.expense_reports r
  left join public.expenses e on e.report_id = r.id
  group by r.id;
grant select on public.expense_reports_totaux to authenticated;
