-- 16_gz_participant_season_stats.sql
-- Onglet Participants : filtre par saison (defaut = saison en cours), comme Financier
-- et Site public. Il faut des stats participations/victoires PAR SAISON (la vue
-- gz_participant_stats agrege toutes saisons). Meme securite que les vues existantes
-- (security_invoker : la RLS gz_* de l'appelant s'applique -> officials OK).
create or replace view public.gz_participant_season_stats
with (security_invoker = on) as
with parts as (
  select e.participant_id, t.season_id,
         count(distinct e.tournament_id) as participations
  from gz_entries e
  join gz_tournaments t on t.id = e.tournament_id
  where e.confirmed and t.season_id is not null
  group by e.participant_id, t.season_id
),
vics as (
  select s.participant_id, t.season_id, count(*) as victoires
  from gz_player_status s
  join gz_tournaments t on t.id = s.tournament_id
  where s.is_winner and t.is_gamezone and t.season_id is not null
  group by s.participant_id, t.season_id
)
select coalesce(p.participant_id, v.participant_id) as participant_id,
       coalesce(p.season_id, v.season_id) as season_id,
       coalesce(p.participations, 0) as participations,
       coalesce(v.victoires, 0) as victoires
from parts p
full join vics v on v.participant_id = p.participant_id and v.season_id = p.season_id;

grant select on public.gz_participant_season_stats to authenticated, anon;
