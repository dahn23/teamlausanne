-- 53_mail_draft_attachments.sql
-- Messagerie : les pieces jointes suivent desormais le brouillon.
-- Avant, mailComposeSaveDraft n'enregistrait que le texte (« les pieces jointes ne sont
-- pas conservees ») : rouvrir un brouillon perdait les PDF. On stocke les fichiers dans
-- un bucket prive et on garde leurs metadonnees dans la colonne files.
--
-- Chemin : <user_id>/<draft_id>/<uuid>-<nom du fichier>
--   -> foldername[1] = proprietaire (isole chaque membre du staff)
--   -> foldername[2] = brouillon    (permet la purge par brouillon)

alter table public.mail_compose_drafts
  add column if not exists files jsonb not null default '[]'::jsonb;

-- Bucket prive. 8 Mo par fichier = la limite deja appliquee cote client.
insert into storage.buckets (id, name, public, file_size_limit)
values ('mail-drafts', 'mail-drafts', false, 8388608)
on conflict (id) do nothing;

-- Acces : chacun ne voit que ses propres pieces jointes, et doit etre staff.
-- Meme regle que la table mail_compose_drafts (policy mcd_own).
drop policy if exists mail_drafts_own on storage.objects;
create policy mail_drafts_own on storage.objects for all
  to authenticated
  using (
    bucket_id = 'mail-drafts'
    and (storage.foldername(name))[1] = auth.uid()::text
    and is_staff(auth.uid())
  )
  with check (
    bucket_id = 'mail-drafts'
    and (storage.foldername(name))[1] = auth.uid()::text
    and is_staff(auth.uid())
  );

-- Purge : un brouillon sans modification depuis 7 jours part, fichiers compris.
-- Sinon les PDF abandonnes s'accumulent indefiniment dans le bucket.
create or replace function public.purge_old_mail_drafts()
returns integer language plpgsql security definer set search_path = public, storage as $$
declare
  gone integer;
begin
  delete from storage.objects
   where bucket_id = 'mail-drafts'
     and (storage.foldername(name))[2] in (
       select id::text from public.mail_compose_drafts
        where updated_at < now() - interval '7 days');

  with d as (
    delete from public.mail_compose_drafts
     where updated_at < now() - interval '7 days'
    returning 1)
  select count(*) into gone from d;

  return gone;
end $$;
revoke all on function public.purge_old_mail_drafts() from public, anon, authenticated;

-- Tous les jours a 03:15 UTC.
select cron.unschedule('purge-mail-drafts')
 where exists (select 1 from cron.job where jobname = 'purge-mail-drafts');
select cron.schedule('purge-mail-drafts', '15 3 * * *',
  $cron$select public.purge_old_mail_drafts()$cron$);
