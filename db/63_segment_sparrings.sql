-- 63_segment_sparrings.sql
-- Plusieurs sparrings par bloc de séance : table dédiée (remplace les colonnes
-- sparring_person_id / sparring_name de la migration 62).
--   person_id renseigné = personne du répertoire (sa fiche totalise ses heures de sparring :
--   temps d'entraînement offert, à montrer aux parents) ; sinon nom libre.
-- RLS : head_coach + admin/superadmin, comme les blocs.

create table if not exists public.course_segment_sparrings (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references public.course_segments(id) on delete cascade,
  person_id uuid references public.people(id),
  name text not null,
  seq int not null default 0
);
create index if not exists idx_css_segment on public.course_segment_sparrings(segment_id);
create index if not exists idx_css_person on public.course_segment_sparrings(person_id);

alter table public.course_segment_sparrings enable row level security;
drop policy if exists css_head on public.course_segment_sparrings;
create policy css_head on public.course_segment_sparrings for all
  using (is_admin(auth.uid()) or has_role(auth.uid(),'head_coach'))
  with check (is_admin(auth.uid()) or has_role(auth.uid(),'head_coach'));

-- Reprise des valeurs déjà saisies (migration 62), puis suppression des anciennes colonnes.
insert into public.course_segment_sparrings (segment_id, person_id, name, seq)
select s.id, s.sparring_person_id,
       coalesce(nullif(s.sparring_name, ''), (select p.first_name || ' ' || p.last_name from public.people p where p.id = s.sparring_person_id), '?'),
       0
  from public.course_segments s
 where s.sparring_person_id is not null or nullif(s.sparring_name, '') is not null;

drop index if exists public.idx_cs_sparring;
alter table public.course_segments drop column if exists sparring_person_id, drop column if exists sparring_name;
