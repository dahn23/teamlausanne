-- Newsletter : éditeur par blocs
--
-- Jusqu'ici une newsletter n'était qu'un champ HTML libre (51_newsletter.sql).
-- On garde ce champ — c'est lui que l'envoi lit, rien ne change de ce côté —
-- et on ajoute à côté la liste des blocs qui l'a produit.
--
-- Pourquoi les deux : le HTML seul ne se remonte pas dans un éditeur (on ne
-- peut pas deviner qu'un tableau était un « bouton »), et les blocs seuls
-- obligeraient à recompiler à l'envoi. Les blocs sont la source, le HTML est le
-- rendu figé. Une newsletter écrite avant cet ajout a blocks à null : l'éditeur
-- la reprend alors comme un unique bloc « texte », donc rien n'est perdu.
alter table public.newsletters
  add column if not exists blocks jsonb;

-- Les images posées dans les blocs. Un bucket public : une image de newsletter
-- est lue par les destinataires depuis leur boîte mail, sans session — elle ne
-- peut donc pas être protégée, et ne doit contenir que du visuel de campagne.
insert into storage.buckets (id, name, public, file_size_limit)
values ('newsletter', 'newsletter', true, 5242880)
on conflict (id) do update
  set public = true, file_size_limit = 5242880;

drop policy if exists nl_img_lecture     on storage.objects;
drop policy if exists nl_img_ecriture    on storage.objects;
drop policy if exists nl_img_suppression on storage.objects;

create policy nl_img_lecture on storage.objects
  for select to public
  using (bucket_id = 'newsletter');

create policy nl_img_ecriture on storage.objects
  for insert to authenticated
  with check (bucket_id = 'newsletter' and is_staff(auth.uid()));

create policy nl_img_suppression on storage.objects
  for delete to authenticated
  using (bucket_id = 'newsletter' and is_staff(auth.uid()));
