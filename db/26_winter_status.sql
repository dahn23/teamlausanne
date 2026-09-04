-- 26_winter_status.sql
-- Saison hiver : (1) le court devient texte pour accueillir « Fitness » en plus des numeros,
-- (2) statut par case cliquable : libre (blanc) -> pre (jaune) -> confirme (vert).
alter table public.winter_plan alter column court type text using court::text;
alter table public.winter_plan add column if not exists status text not null default 'libre';  -- libre | pre | confirme
