-- 24_tennis_notes.sql
-- Sous-onglet « Tennis » de la fiche repertoire.
-- Visible pour les joueurs des filieres competition / performance / sport-etudes / pro-u18 / pro.
-- Commentaires techniques par THEME (global, coup droit, revers, slice, service, volee, tactique)
-- et par SAISON. Le plus recent en haut.
-- Acces : vue + ajout = coachs (coach/head_coach/coach_physique/moniteur) + admin/superadmin.
--         edition/suppression = head_coach / admin / superadmin uniquement.

create or replace function public.can_tennis_view(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
    and role in ('coach','head_coach','coach_physique','moniteur','admin','superadmin'));
$$;

create or replace function public.can_tennis_edit(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
    and role in ('head_coach','admin','superadmin'));
$$;

create table if not exists public.tennis_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  player_person_id uuid not null references public.people(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  theme text not null,               -- global | coup_droit | revers | slice | service | volee | tactique
  body text not null,
  author_person_id uuid,
  author_name text,
  author_role text,
  created_by uuid references auth.users(id)
);
create index if not exists tennis_notes_lookup_idx
  on public.tennis_notes(player_person_id, season_id, theme, created_at desc);

alter table public.tennis_notes enable row level security;
drop policy if exists tennis_notes_select on public.tennis_notes;
create policy tennis_notes_select on public.tennis_notes for select
  using (can_tennis_view(auth.uid()));
drop policy if exists tennis_notes_insert on public.tennis_notes;
create policy tennis_notes_insert on public.tennis_notes for insert
  with check (can_tennis_view(auth.uid()));
drop policy if exists tennis_notes_update on public.tennis_notes;
create policy tennis_notes_update on public.tennis_notes for update
  using (can_tennis_edit(auth.uid())) with check (can_tennis_edit(auth.uid()));
drop policy if exists tennis_notes_delete on public.tennis_notes;
create policy tennis_notes_delete on public.tennis_notes for delete
  using (can_tennis_edit(auth.uid()));
grant select, insert, update, delete on public.tennis_notes to authenticated;
