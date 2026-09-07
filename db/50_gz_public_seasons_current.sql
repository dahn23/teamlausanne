-- 50_gz_public_seasons_current.sql
-- Site public GameZone : la saison en cours est TOUJOURS proposée (même sans tournoi importé),
-- plus les saisons passées qui ont eu des tournois GameZone. (Avant : seules les saisons avec tournois,
-- donc la page restait sur 2025/26 tant que 2026/27 n'avait rien.)
create or replace function public.gz_public_seasons()
returns table(id uuid, name text, is_current boolean)
language sql stable security definer set search_path to 'public' as $$
  select s.id, s.name, s.is_current
  from gz_seasons s
  where s.is_current
     or exists (select 1 from gz_tournaments t where t.season_id = s.id and t.is_gamezone = true)
  order by s.start_date desc;
$$;
