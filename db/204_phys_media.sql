-- 204 — Physique : les vidéos et photos du coach, par jeune, visibles dans Mon espace › Physique › Vidéos (23.10.2026).
-- Avant : Andreas déposait ses vidéos dans Fiche › Photos / vidéos (person_media). Le joueur ne les voyait pas, le
-- coach physique n'y a plus accès (can_membres), et les fichiers vivaient dans le bucket PUBLIC gz-photos.
-- Maintenant : table phys_media + bucket PRIVÉ « physique » (déjà celui du fil Prépa physique), chemin
-- « <id du jeune>/media/<uuid>_<nom> » : la policy de stockage physique_files_all (can_phys_of sur le 1er dossier)
-- ouvre donc déjà les fichiers au staff physique et à la famille du jeune, et à personne d'autre.
-- Lecture : can_phys_of (staff physique + famille du jeune). Écriture : staff physique seulement.
create table if not exists public.phys_media (
  id uuid primary key default gen_random_uuid(),
  youth_person_id uuid not null references public.people(id) on delete cascade,
  storage_path text not null,
  file_name text,
  kind text not null check (kind in ('image', 'video')),
  comment text,
  author_person_id uuid references public.people(id) on delete set null,
  author_name text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists phys_media_youth on public.phys_media (youth_person_id, created_at desc);
alter table public.phys_media enable row level security;
create policy phys_media_lire on public.phys_media for select using (can_phys_of(youth_person_id));
create policy phys_media_ecrire on public.phys_media for all
  using (is_phys_staff(auth.uid())) with check (is_phys_staff(auth.uid()));

-- Reprise des vidéos d'Andreas (18.09.2026) : 27 fichiers de 8 jeunes copiés du bucket public gz-photos vers
-- « physique » par une fonction ponctuelle (copie de fichiers = API de stockage, pas du SQL), puis effacés de
-- gz-photos et de person_media. Les 3 de Berti Murina (parti) : effacés sans copie.
