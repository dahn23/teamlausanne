-- Pièces jointes des mails ouvrables sur mobile (24.09.2026).
-- Un lien « data:…;base64 » avec download ne fait rien dans l'app native (WebView) ni sur certains
-- navigateurs mobiles. On copie la pièce jointe dans un bucket privé au premier clic, puis on ouvre une
-- URL signée (courte durée) : le navigateur / l'app système affiche ou télécharge le fichier.
-- Chemin : <mail_id>/<attachment_id>-<nom>. Droits = ceux du mail (mail_can_see / official tournoi@).

alter table public.mail_attachments add column if not exists storage_path text;

insert into storage.buckets (id, name, public) values ('mail-att', 'mail-att', false)
on conflict (id) do nothing;

drop policy if exists mail_att_obj on storage.objects;
create policy mail_att_obj on storage.objects for all to authenticated
  using (bucket_id = 'mail-att' and exists (
    select 1 from public.mail_messages m
     where m.id = nullif((storage.foldername(name))[1], '')::uuid
       and ((is_staff(auth.uid()) and mail_can_see(m.account_address, auth.uid()))
         or (is_gz_official(auth.uid()) and m.account_address = 'tournoi@teamlausanne.ch'))))
  with check (bucket_id = 'mail-att' and exists (
    select 1 from public.mail_messages m
     where m.id = nullif((storage.foldername(name))[1], '')::uuid
       and ((is_staff(auth.uid()) and mail_can_see(m.account_address, auth.uid()))
         or (is_gz_official(auth.uid()) and m.account_address = 'tournoi@teamlausanne.ch'))));
