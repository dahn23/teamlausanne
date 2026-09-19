-- 74_courses_trash.sql
-- Corbeille des cours supprimés en lot (ex. jour férié) : copie complète (cours, coachs, joueurs, courts)
-- pour pouvoir les recréer. RLS activée SANS policy : illisible depuis la console, accès serveur seulement.
-- 1er usage : les 13 cours du lundi 21.09.2026 (Lundi du Jeûne fédéral), supprimés à la demande de Dan.
create table if not exists public.courses_trash (
  id uuid primary key default gen_random_uuid(),
  deleted_at timestamptz not null default now(),
  reason text,
  course_date date,
  payload jsonb not null
);
alter table public.courses_trash enable row level security;
