-- 47_phys_notes.sql
-- Fil « Physique » dans le sous-onglet Tests physiques de la fiche (jeunes sport-études / pro / pro U18).
-- Un seul fil (pas de thème ni de saison) : qui a écrit quoi, quand. Même modèle que tennis_notes.
-- Accès vue + ajout : coach / coach_physique / head_coach / admin / superadmin.
-- Édition / suppression : head_coach / admin / superadmin, ou l'auteur de la note.
create or replace function public.can_phys_notes(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
    and role in ('coach','coach_physique','head_coach','admin','superadmin'));
$$;

create table if not exists public.phys_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  player_person_id uuid not null references public.people(id) on delete cascade,
  body text not null,
  author_person_id uuid, author_name text, author_role text,
  created_by uuid references auth.users(id)
);
create index if not exists phys_notes_lookup_idx on public.phys_notes(player_person_id, created_at desc);
alter table public.phys_notes enable row level security;
drop policy if exists phys_notes_select on public.phys_notes;
create policy phys_notes_select on public.phys_notes for select using (can_phys_notes(auth.uid()));
drop policy if exists phys_notes_insert on public.phys_notes;
create policy phys_notes_insert on public.phys_notes for insert with check (can_phys_notes(auth.uid()));
drop policy if exists phys_notes_update on public.phys_notes;
create policy phys_notes_update on public.phys_notes for update
  using (can_tennis_edit(auth.uid()) or created_by = auth.uid()) with check (can_tennis_edit(auth.uid()) or created_by = auth.uid());
drop policy if exists phys_notes_delete on public.phys_notes;
create policy phys_notes_delete on public.phys_notes for delete using (can_tennis_edit(auth.uid()) or created_by = auth.uid());
grant select, insert, update, delete on public.phys_notes to authenticated;
