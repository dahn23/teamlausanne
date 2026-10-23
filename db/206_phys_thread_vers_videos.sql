-- 206 — Une photo ou une vidéo envoyée par le staff dans le fil « Prépa physique » va AUSSI dans les Vidéos du jeune
-- (Mon espace › Physique › Vidéos), avec le texte du message comme commentaire (23.10.2026).
-- Pourquoi : sur la page d'un jeune, la console a deux 📎 l'un sous l'autre (Vidéos et photos / Prépa physique).
-- Au premier essai, la vidéo est partie dans la discussion — Andreas fera pareil. Quel que soit le bouton, le
-- joueur retrouve donc ses vidéos au même endroit.
-- - Même fichier, pas de copie : phys_media.storage_path pointe sur le fichier du fil (même bucket « physique »).
-- - source_thread_id relie la carte à son message : effacer le message efface la carte (cascade). Effacer la
--   carte dans la console garde le fichier, puisque le message l'affiche encore.
-- - UNE notification : celle du message (push_thread_trg) ; la carte venue du fil n'en envoie pas de seconde.
alter table public.phys_media add column if not exists source_thread_id uuid references public.phys_thread(id) on delete cascade;
create unique index if not exists phys_media_source_thread on public.phys_media (source_thread_id) where source_thread_id is not null;

create or replace function public.phys_thread_vers_videos_trg()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kind text;
begin
  if not new.author_is_staff or new.file_path is null then return new; end if;
  v_kind := case when new.file_name ~* '\.(mp4|mov|m4v|webm)$' then 'video'
                 when new.file_name ~* '\.(jpe?g|png|gif|webp|heic)$' then 'image' end;
  if v_kind is null then return new; end if;   -- un PDF ou un document reste dans la discussion seulement
  insert into phys_media (youth_person_id, storage_path, file_name, kind, comment, author_person_id, author_name, created_by, created_at, source_thread_id)
  values (new.youth_person_id, new.file_path, new.file_name, v_kind, nullif(trim(coalesce(new.body, '')), ''),
          (select pr.person_id from profiles pr where pr.user_id = new.created_by limit 1),
          new.author_name, new.created_by, new.created_at, new.id)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists trg_phys_thread_vers_videos on public.phys_thread;
create trigger trg_phys_thread_vers_videos after insert on public.phys_thread
  for each row execute function public.phys_thread_vers_videos_trg();

-- La notification de la carte : pas pour celles qui viennent du fil (le message a déjà notifié).
create or replace function public.push_phys_media_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.source_thread_id is not null then return new; end if;
  perform push_enqueue(
    array(select x from push_users_for_person(new.youth_person_id) x where x is distinct from new.created_by),
    'Physique — ' || case when new.kind = 'video' then 'nouvelle vidéo' else 'nouvelle photo' end,
    coalesce(nullif(trim(new.author_name), ''), 'Ton coach') || ' : '
      || coalesce(nullif(trim(new.comment), ''), case when new.kind = 'video' then 'une vidéo pour toi' else 'une photo pour toi' end),
    '/espace.html?vue=physique&sous=videos', 'phys_media');
  return new;
end $$;

-- Reprise : les photos et vidéos déjà envoyées par le staff dans un fil (le déclencheur n'agit que sur les nouvelles).
insert into phys_media (youth_person_id, storage_path, file_name, kind, comment, author_person_id, author_name, created_by, created_at, source_thread_id)
select t.youth_person_id, t.file_path, t.file_name,
       case when t.file_name ~* '\.(mp4|mov|m4v|webm)$' then 'video' else 'image' end,
       nullif(trim(coalesce(t.body, '')), ''),
       (select pr.person_id from profiles pr where pr.user_id = t.created_by limit 1),
       t.author_name, t.created_by, t.created_at, t.id
from phys_thread t
where t.author_is_staff and t.file_path is not null and t.file_name ~* '\.(jpe?g|png|gif|webp|heic|mp4|mov|m4v|webm)$'
on conflict do nothing;
