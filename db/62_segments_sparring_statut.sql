-- 62_segments_sparring_statut.sql
-- Blocs de séance (course_segments) :
--   * status : 'jeu' (défaut) | 'blesse' | 'repos' — un bloc « blessé » ou « au repos » sert à tracer
--     le temps d'un joueur qui n'a pas joué (compté à part sur sa fiche : heures + nombre de fois).
--   * sparring : personne du répertoire (sparring_person_id) OU nom libre (sparring_name).
--     Sur la fiche d'une personne du répertoire, on totalise ses heures de sparring, à combien et avec qui.
-- Les cours privés (type « … Privé ») reçoivent une note via UN bloc couvrant toute la séance.
-- RLS inchangée : head_coach + admin/superadmin.

alter table public.course_segments
  add column if not exists status text not null default 'jeu',
  add column if not exists sparring_person_id uuid references public.people(id),
  add column if not exists sparring_name text;

alter table public.course_segments drop constraint if exists course_segments_status_chk;
alter table public.course_segments
  add constraint course_segments_status_chk check (status in ('jeu','blesse','repos'));

create index if not exists idx_cs_sparring on public.course_segments(sparring_person_id);
