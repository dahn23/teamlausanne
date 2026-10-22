-- ---------------------------------------------------------------------------
-- NOTES DE FRAIS — les dépenses avancées par l'équipe pour l'académie.
--
-- Chacun saisit les siennes, dépose le justificatif, et voit en bas de sa page
-- ce que l'académie lui doit. Dan, Raphael et Arsalan voient et corrigent tout
-- le monde : Arsalan parce qu'il vérifie que chaque dépense est rangée sous le
-- bon compte.
--
-- CE QUE LA RLS TIENT, et c'est le cœur : une note de frais est un document
-- personnel. Sans garde, chacun lirait les dépenses des autres — ce qui en dit
-- long sur les déplacements, les repas et les habitudes de chacun. La règle
-- est donc « la mienne, ou tout si j'en ai le droit », et jamais « tout le
-- staff ».
--
-- Un justificatif est OBLIGATOIRE à la validation, pas à la saisie : on dépose
-- le PDF, l'IA en tire les champs, on corrige, puis on valide. L'ordre compte
-- — exiger le PDF d'abord obligerait à ressaisir ce que le PDF contient déjà.
-- ---------------------------------------------------------------------------

-- --- Qui suis-je, et qu'ai-je le droit de voir ------------------------------

-- La fiche liée au compte connecté. Beaucoup d'écrans en ont besoin et
-- chacun le refaisait à sa façon ; ici une seule définition.
create or replace function public.my_person_id()
returns uuid language sql stable security definer set search_path to 'public' as $$
  select p.person_id from profiles p where p.user_id = auth.uid() limit 1;
$$;

-- Tout employé. Même règle que l'Aide : avoir un rôle, sauf « affichage »,
-- l'écran du hall. Un prof ou un coach mental avance des frais comme un autre.
create or replace function public.can_notes_frais(uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from user_roles where user_id = uid and role <> 'affichage');
$$;

-- Voir et corriger les notes de TOUT LE MONDE.
--
-- PAS par le rôle « secretaire », et c'est délibéré : Séline l'a parmi ses
-- quatre rôles, et elle dépose ses propres frais. Une note de frais dit où
-- l'on mange, où l'on se déplace et quand — ça ne s'ouvre pas par effet de
-- bord d'un intitulé de poste.
--
-- Dan et Raphael l'ont par l'administration ; Arsalan par un rôle de fiche
-- « finance », posé nommément et retirable en un clic. Même crochet que
-- can_billing, donc rien de nouveau à comprendre.
create or replace function public.can_notes_frais_all(uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from user_roles
                  where user_id = uid and role in ('superadmin','admin'))
      or exists (select 1 from person_roles pr join profiles p on p.person_id = pr.person_id
                  where p.user_id = uid and pr.role = 'finance');
$$;

-- Arsalan Huber : le droit nommément.
insert into public.person_roles (person_id, role)
select pr.person_id, 'finance'
from public.profiles pr join auth.users u on u.id = pr.user_id
where u.email = 'arsalan_huber@yahoo.com'
on conflict do nothing;

-- --- Les catégories ---------------------------------------------------------
--
-- Une table et non du texte libre : Arsalan vérifie que la dépense est sous le
-- bon compte, et « essence »/« carburant »/« benzine » saisis à la main
-- rendraient ce contrôle impossible.
create table if not exists public.expense_categories (
  code    text primary key,
  label   text not null,
  sort    int  not null default 100,
  active  boolean not null default true
);

insert into public.expense_categories (code, label, sort) values
  ('fournitures',   'Fournitures de bureau',       10),
  ('affranchissement','Port et affranchissement',  20),
  ('carburant',     'Carburant',                   30),
  ('deplacement',   'Déplacement (train, taxi, parking)', 40),
  ('repas',         'Repas et réception',          50),
  ('materiel',      'Matériel sportif',            60),
  ('entretien',     'Entretien et petit outillage',70),
  ('informatique',  'Informatique et abonnements', 80),
  ('divers',        'Divers',                      999)
on conflict (code) do nothing;

-- --- Les dépenses -----------------------------------------------------------
create table if not exists public.expenses (
  id             uuid primary key default gen_random_uuid(),
  person_id      uuid not null references public.people(id) on delete cascade,
  expense_date   date not null,
  transaction_no text,
  category       text references public.expense_categories(code),
  amount         numeric not null check (amount > 0),
  currency       text not null default 'CHF',
  note           text,
  -- Le justificatif, dans le bucket privé « notes-de-frais ».
  pdf_path       text,
  -- « a_valider » : l'IA a lu le PDF, personne n'a encore confirmé.
  -- « valide »   : l'employé confirme — c'est là que le justificatif devient
  --                obligatoire (contrainte ci-dessous).
  -- « rembourse » : versé. La ligne se fige pour son auteur.
  statut         text not null default 'a_valider'
                 check (statut in ('a_valider','valide','rembourse')),
  -- Ce que l'IA a cru lire, gardé tel quel à côté de ce qui a été corrigé.
  -- C'est ce qui permettra de savoir si l'extraction s'améliore ou dérive.
  extraction     jsonb,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz,
  updated_by     uuid,
  reimbursed_at  timestamptz,
  reimbursed_by  uuid,
  -- Pas de validation sans justificatif : c'est la règle de la note de frais.
  constraint expenses_justificatif
    check (statut = 'a_valider' or pdf_path is not null)
);

create index if not exists expenses_personne on public.expenses (person_id, expense_date desc);
create index if not exists expenses_date     on public.expenses (expense_date desc);
create index if not exists expenses_statut   on public.expenses (statut, expense_date desc);

-- --- RLS --------------------------------------------------------------------
alter table public.expenses            enable row level security;
alter table public.expense_categories  enable row level security;

-- Les catégories sont une nomenclature : tout le staff les lit, personne ne
-- les change depuis l'application.
drop policy if exists expense_cat_lecture on public.expense_categories;
create policy expense_cat_lecture on public.expense_categories
  for select to authenticated using (public.can_notes_frais(auth.uid()));

drop policy if exists expenses_lecture on public.expenses;
create policy expenses_lecture on public.expenses
  for select to authenticated
  using (person_id = public.my_person_id() or public.can_notes_frais_all(auth.uid()));

-- On ne saisit que POUR SOI. Les correcteurs passent par update, pas par une
-- saisie au nom d'un autre : une dépense doit avoir un auteur certain.
drop policy if exists expenses_saisie on public.expenses;
create policy expenses_saisie on public.expenses
  for insert to authenticated
  with check (person_id = public.my_person_id() and public.can_notes_frais(auth.uid()));

-- L'auteur corrige tant que ce n'est pas remboursé ; les responsables,
-- toujours — c'est exactement ce que demande la règle « Dan, Raphael et
-- Arsalan peuvent corriger une dépense si besoin ».
drop policy if exists expenses_correction on public.expenses;
create policy expenses_correction on public.expenses
  for update to authenticated
  using ((person_id = public.my_person_id() and statut <> 'rembourse')
         or public.can_notes_frais_all(auth.uid()))
  with check ((person_id = public.my_person_id() and statut <> 'rembourse')
         or public.can_notes_frais_all(auth.uid()));

-- On ne supprime que ce qui n'est pas encore validé. Après, ça se corrige.
drop policy if exists expenses_suppression on public.expenses;
create policy expenses_suppression on public.expenses
  for delete to authenticated
  using ((person_id = public.my_person_id() and statut = 'a_valider')
         or public.can_notes_frais_all(auth.uid()));

-- --- Le justificatif --------------------------------------------------------
--
-- Bucket privé. Le chemin est « <person_id>/<expense_id>.pdf » : la première
-- partie du chemin EST le propriétaire, ce qui rend la règle d'accès lisible
-- sans rien joindre.
insert into storage.buckets (id, name, public)
values ('notes-de-frais', 'notes-de-frais', false)
on conflict (id) do nothing;

drop policy if exists nf_lecture on storage.objects;
create policy nf_lecture on storage.objects
  for select to authenticated
  using (bucket_id = 'notes-de-frais'
         and ((storage.foldername(name))[1] = public.my_person_id()::text
              or public.can_notes_frais_all(auth.uid())));

drop policy if exists nf_depot on storage.objects;
create policy nf_depot on storage.objects
  for insert to authenticated
  with check (bucket_id = 'notes-de-frais'
              and ((storage.foldername(name))[1] = public.my_person_id()::text
                   or public.can_notes_frais_all(auth.uid())));

drop policy if exists nf_remplacement on storage.objects;
create policy nf_remplacement on storage.objects
  for update to authenticated
  using (bucket_id = 'notes-de-frais'
         and ((storage.foldername(name))[1] = public.my_person_id()::text
              or public.can_notes_frais_all(auth.uid())));

drop policy if exists nf_suppression on storage.objects;
create policy nf_suppression on storage.objects
  for delete to authenticated
  using (bucket_id = 'notes-de-frais'
         and ((storage.foldername(name))[1] = public.my_person_id()::text
              or public.can_notes_frais_all(auth.uid())));

comment on table public.expenses is
  'Notes de frais : dépenses avancées par un employé, avec leur justificatif PDF.';
