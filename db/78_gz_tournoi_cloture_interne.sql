-- 78 — GameZone : notre clôture est stockée à part du statut Swiss Tennis (21.09.2026).
-- Avant : gz_close_tournament écrivait status = 'Clôturé', mais gz-import réécrit `status` à chaque import
-- (« Publié », « Terminé »…) → la clôture disparaissait et le responsable retrouvait l'accès au tournoi.
-- Maintenant : colonne closed_at, jamais touchée par l'import. `status` = uniquement le statut Swiss Tennis.
alter table public.gz_tournaments add column if not exists closed_at timestamptz;

update public.gz_tournaments t set closed_at = coalesce(c.closed_at, now())
from public.gz_caisse c
where c.tournament_id = t.id and c.closed and t.closed_at is null;

update public.gz_tournaments set closed_at = now() where status = 'Clôturé' and closed_at is null;

create or replace function public.gz_manages(p_tournament uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists (
    select 1
    from gz_managers m
    join profiles pr on pr.person_id = m.person_id
    join gz_tournaments t on t.id = m.tournament_id
    where m.tournament_id = p_tournament
      and pr.user_id = auth.uid()
      and t.closed_at is null
      and coalesce(t.status, '') <> 'Clôturé'
  );
$function$;

create or replace function public.gz_is_manager()
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists (
    select 1
    from gz_managers m
    join profiles pr on pr.person_id = m.person_id
    join gz_tournaments t on t.id = m.tournament_id
    where pr.user_id = auth.uid()
      and t.closed_at is null
      and coalesce(t.status, '') <> 'Clôturé'
  );
$function$;

create or replace function public.gz_close_tournament(p_tournament uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not (is_staff(auth.uid()) or gz_manages(p_tournament)) then
    raise exception 'non autorisé';
  end if;
  update gz_tournaments set closed_at = coalesce(closed_at, now()) where id = p_tournament;
end;
$function$;
