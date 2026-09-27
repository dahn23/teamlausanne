-- 27.09.2026 : un responsable de tournoi GameZone (gz_managers, sans rôle console) ne pouvait pas déposer la photo
-- des vainqueurs : « new row violates row-level security policy » sur le bucket gz-photos, ouvert seulement au staff
-- et aux organisateurs. Il peut désormais écrire dans le dossier de SES tournois (chemin = <tournament_id>/…),
-- comme il le fait déjà dans gz_player_status (policy gz_manages).
-- Le dossier n'est converti en uuid que s'il en a la forme (les images des messages sont dans « news/… »).

create or replace function public.gz_manages_path(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when (storage.foldername(p_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then gz_manages(((storage.foldername(p_name))[1])::uuid) else false end;
$$;
grant execute on function public.gz_manages_path(text) to authenticated;

drop policy if exists gzphotos_write on storage.objects;
create policy gzphotos_write on storage.objects for insert
  with check (bucket_id = 'gz-photos' and (is_staff(auth.uid()) or is_gz_official(auth.uid()) or gz_manages_path(name)));
drop policy if exists gzphotos_update on storage.objects;
create policy gzphotos_update on storage.objects for update
  using (bucket_id = 'gz-photos' and (is_staff(auth.uid()) or is_gz_official(auth.uid()) or gz_manages_path(name)))
  with check (bucket_id = 'gz-photos' and (is_staff(auth.uid()) or is_gz_official(auth.uid()) or gz_manages_path(name)));
drop policy if exists gzphotos_delete on storage.objects;
create policy gzphotos_delete on storage.objects for delete
  using (bucket_id = 'gz-photos' and (is_staff(auth.uid()) or is_gz_official(auth.uid()) or gz_manages_path(name)));
