-- 76 — GameZone : un tournoi sans saison prend automatiquement celle de sa date.
-- Constat du 21.09.2026 : les tournois importés depuis le 06.09 avaient season_id = NULL ;
-- le site public (classement + photos des vainqueurs) filtre sur la saison → rien n'apparaissait.

create or replace function public.gz_tournament_set_season()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.season_id is null and new.tournament_date is not null then
    select s.id into new.season_id
    from gz_seasons s
    where new.tournament_date between s.start_date and s.end_date
    order by s.start_date desc
    limit 1;
  end if;
  return new;
end $$;

drop trigger if exists trg_gz_tournament_set_season on public.gz_tournaments;
create trigger trg_gz_tournament_set_season
  before insert or update of tournament_date, season_id on public.gz_tournaments
  for each row execute function public.gz_tournament_set_season();

-- Rattrapage des tournois déjà en base.
update public.gz_tournaments t
set season_id = s.id
from public.gz_seasons s
where t.season_id is null
  and t.tournament_date between s.start_date and s.end_date;
