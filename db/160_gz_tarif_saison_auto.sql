-- 160 — GameZone : catégorie de tarifs choisie d'office selon la saison (15.10.2026, demande de Dan).
-- Un tournoi GameZone sans catégorie reçoit « GameZone hiver » pendant la saison des bulles (15.10 → 14.04,
-- même règle que les courts : season_of) et « GameZone été » le reste de l'année. À la création (import) ou quand
-- on coche GameZone / change la date ; une catégorie déjà choisie à la main n'est jamais remplacée.

create or replace function public.gz_tarif_saison_trg()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.is_gamezone and new.price_category_id is null and new.tournament_date is not null then
    select id into new.price_category_id from gz_price_categories
     where name ilike 'GameZone%' and name ilike case season_of(new.tournament_date) when 'hiver' then '%hiver%' else '%été%' end
     order by created_at limit 1;
  end if;
  return new;
end $$;
revoke all on function public.gz_tarif_saison_trg() from public, anon, authenticated;

drop trigger if exists trg_gz_tarif_saison on public.gz_tournaments;
create trigger trg_gz_tarif_saison
  before insert or update of is_gamezone, tournament_date on public.gz_tournaments
  for each row execute function gz_tarif_saison_trg();

-- Rattrapage : les GameZone à venir sans catégorie.
update gz_tournaments t set price_category_id = c.id
  from gz_price_categories c
 where t.is_gamezone and t.price_category_id is null and t.tournament_date >= current_date
   and c.name ilike 'GameZone%'
   and c.name ilike case season_of(t.tournament_date) when 'hiver' then '%hiver%' else '%été%' end;
