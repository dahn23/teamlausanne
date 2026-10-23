-- 205 — Notification quand le coach ajoute une vidéo ou une photo pour un jeune (Physique, db/204), 23.10.2026.
-- Même circuit que les messages du fil Prépa physique (push_thread_trg) : push_enqueue vers les comptes qui voient
-- ce jeune (lui et ses parents, push_users_for_person), sauf l'auteur. Le lien ouvre Mon espace › Physique › Vidéos.
create or replace function public.push_phys_media_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform push_enqueue(
    array(select x from push_users_for_person(new.youth_person_id) x where x is distinct from new.created_by),
    'Physique — ' || case when new.kind = 'video' then 'nouvelle vidéo' else 'nouvelle photo' end,
    coalesce(nullif(trim(new.author_name), ''), 'Ton coach') || ' : '
      || coalesce(nullif(trim(new.comment), ''), case when new.kind = 'video' then 'une vidéo pour toi' else 'une photo pour toi' end),
    '/espace.html?vue=physique&sous=videos', 'phys_media');
  return new;
end $$;

drop trigger if exists trg_push_phys_media on public.phys_media;
create trigger trg_push_phys_media after insert on public.phys_media
  for each row execute function public.push_phys_media_trg();
