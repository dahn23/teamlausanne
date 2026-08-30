-- 12_gz_official_full_access.sql
-- Role "official" (organisateur) = acces COMPLET (voir + editer) a TOUS les tournois
-- GameZone, toutes saisons — SANS acces au reste de la console (on ne l'ajoute PAS
-- a is_staff). Avant : la RLS limitait aux tournois dont on est responsable (gz_managers),
-- donc un official non nomme ne voyait rien. Decision Dan (30/08/2026) : official = comme
-- staff GameZone. Applique via migration gz_official_full_access.

create or replace function public.is_gz_official(uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from user_roles where user_id = uid and role in ('superadmin','admin','organisateur'));
$$;

-- Policy "<table>_official" (FOR ALL, is_gz_official) sur toutes les tables gz_* :
do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relname like 'gz\_%'
  loop
    execute format('drop policy if exists %I on public.%I', t || '_official', t);
    execute format('create policy %I on public.%I for all using (is_gz_official(auth.uid())) with check (is_gz_official(auth.uid()))', t || '_official', t);
  end loop;
end $$;
