-- 12.10.2026 (décision Dan) : sous-onglet « Rushes » du Social Media Planner.
-- Une SESSION de rushes = des vidéos brutes déposées dans un dossier (Google Drive…), avec des consignes.
-- Le traitement (transcription Whisper, découpe, recadrage 9:16 / 4:5 / 16:9, sous-titres, textes par réseau)
-- se fait avec Claude sur le PC de Dan ; les extraits reviennent ici comme BROUILLONS de publications
-- (social_posts.rush_id), vidéo dans la médiathèque et un texte par canal.
-- Au passage : canaux LinkedIn et YouTube (Shorts), et vidéos acceptées dans le bucket « social ».

create table if not exists public.social_rushes (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  date_tournage date,
  dossier text,                                   -- où sont les fichiers (dossier Drive, lien…)
  consignes text,                                 -- ce qu'on veut en tirer
  canaux text[] not null default array['instagram','tiktok'],
  statut text not null default 'a_traiter' check (statut in ('a_traiter','en_cours','traite')),
  rapport text,                                   -- compte rendu du traitement (moments retenus, durées…)
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.social_rushes enable row level security;
drop policy if exists soc_rush_lire on public.social_rushes;
create policy soc_rush_lire on public.social_rushes for select to authenticated using (can_social(auth.uid()));
drop policy if exists soc_rush_ecrire on public.social_rushes;
create policy soc_rush_ecrire on public.social_rushes for all to authenticated
  using (can_social_edit(auth.uid())) with check (can_social_edit(auth.uid()));
grant select, insert, update, delete on public.social_rushes to authenticated;

-- Une publication peut venir d'une session de rushes, avec son format (reel, short, carrousel…).
alter table public.social_posts add column if not exists rush_id uuid references public.social_rushes(id) on delete set null;
alter table public.social_posts add column if not exists format text;
create index if not exists social_posts_rush_idx on public.social_posts(rush_id);

-- Canaux LinkedIn et YouTube (Shorts) dans les variantes de texte.
alter table public.social_post_variants drop constraint if exists social_post_variants_canal_check;
alter table public.social_post_variants add constraint social_post_variants_canal_check
  check (canal = any (array['instagram','tiktok','newsletter','linkedin','youtube']));

-- Vidéos : un extrait de 60 s en 1080×1920 pèse 20 à 60 Mo (limite précédente : 25 Mo, pensée pour des images).
update storage.buckets set file_size_limit = 314572800 where id = 'social';
