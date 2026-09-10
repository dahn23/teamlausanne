-- 54_mail_draft_purge_orphans.sql
-- Correctif de 53 : la purge ne pouvait pas nettoyer les orphelins.
-- Elle ne visait que les fichiers dont l'identifiant de brouillon figure encore dans
-- mail_compose_drafts. Si la ligne avait deja disparu (envoi, suppression, ou echec de
-- la purge cote client), le fichier restait indefiniment dans le bucket.
create or replace function public.purge_old_mail_drafts()
returns integer language plpgsql security definer set search_path = public, storage as $$
declare
  gone integer;
begin
  -- 1. Fichiers des brouillons inactifs depuis 7 jours.
  delete from storage.objects
   where bucket_id = 'mail-drafts'
     and (storage.foldername(name))[2] in (
       select id::text from public.mail_compose_drafts
        where updated_at < now() - interval '7 days');

  -- 2. Fichiers dont le brouillon n'existe plus du tout. Le delai de 7 jours evite de
  --    supprimer ceux d'un brouillon en cours de creation : le fichier part au stockage
  --    juste avant que la ligne ne soit ecrite.
  delete from storage.objects o
   where o.bucket_id = 'mail-drafts'
     and o.created_at < now() - interval '7 days'
     and not exists (
       select 1 from public.mail_compose_drafts d
        where d.id::text = (storage.foldername(o.name))[2]);

  with d as (
    delete from public.mail_compose_drafts
     where updated_at < now() - interval '7 days'
    returning 1)
  select count(*) into gone from d;

  return gone;
end $$;
revoke all on function public.purge_old_mail_drafts() from public, anon, authenticated;
