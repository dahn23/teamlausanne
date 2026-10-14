-- Déplacements : un coach et des joueurs en tournoi, hors du club (14.10.2026).
--
-- Jusqu'ici, le planning ne savait dire qu'une chose : « ce court est pris, à
-- cette heure ». Un coach parti trois jours à Bâle avec deux juniors
-- n'apparaissait donc nulle part — sa semaine semblait vide alors qu'il
-- travaillait, et personne ne pouvait voir, en ouvrant la grille, qui était
-- absent du club et où.
--
-- POURQUOI UNE TABLE À PART, et pas un `courses` sans court :
--   · un cours a une heure de début et de fin, obligatoires ; un déplacement a
--     des JOURS (vendredi → dimanche), et inventer « 00h00–23h59 » serait une
--     fausse donnée qui polluerait tous les calculs horaires ;
--   · `coach_heures_periode` (db/146) somme les `courses` ; y verser un
--     déplacement gonflerait les heures d'enseignement d'un coach et casserait
--     la comparaison entre coachs, qui est tout l'intérêt du bloc. Décision du
--     secrétariat : un déplacement ne compte PAS dans ces heures.
--   · un cours bloque des courts (court_bookings) ; un déplacement n'en bloque
--     aucun, par définition.
-- Deux natures différentes, deux tables. Elles se rejoignent seulement à
-- l'affichage, en bandeau au-dessus de la grille.

create table if not exists public.away_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'tournoi' check (kind in ('tournoi', 'stage', 'formation', 'autre')),
  label text not null check (length(btrim(label)) between 2 and 160),
  -- La destination telle qu'on la dit : « Bâle », « Tarbes », « Roland-Garros ».
  place text,
  -- Suisse ou étranger : le secrétariat voulait pouvoir trancher d'un clic sans
  -- écrire une ville. Facultatif — les deux champs se complètent, aucun ne
  -- remplace l'autre.
  scope text check (scope in ('suisse', 'etranger')),
  start_date date not null,
  end_date date not null,
  color text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint away_dates_ordre check (end_date >= start_date),
  -- Un déplacement de plus d'un mois est une faute de frappe, pas un tournoi.
  constraint away_duree_plausible check (end_date - start_date <= 31)
);
create index if not exists away_events_dates_idx on public.away_events(start_date, end_date);

create table if not exists public.away_coaches (
  event_id uuid not null references public.away_events(id) on delete cascade,
  coach_person_id uuid not null references public.people(id) on delete cascade,
  primary key (event_id, coach_person_id)
);
create index if not exists away_coaches_person_idx on public.away_coaches(coach_person_id);

create table if not exists public.away_players (
  event_id uuid not null references public.away_events(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  primary key (event_id, person_id)
);
create index if not exists away_players_person_idx on public.away_players(person_id);

-- ---------------------------------------------------------------------------
-- Droits. Le staff écrit. Les familles LISENT le déplacement qui les concerne :
-- un parent doit pouvoir voir que son enfant part à Bâle du 17 au 19, et avec
-- qui. my_family_ids() est déjà la définition du « moi et les miens » utilisée
-- par Mon espace (portal_my_youths) — on ne s'en invente pas une seconde.

alter table public.away_events  enable row level security;
alter table public.away_coaches enable row level security;
alter table public.away_players enable row level security;

drop policy if exists away_events_staff on public.away_events;
create policy away_events_staff on public.away_events for all
  using (is_staff(auth.uid())) with check (is_staff(auth.uid()));

drop policy if exists away_events_concernes on public.away_events;
create policy away_events_concernes on public.away_events for select
  using (
    exists (select 1 from public.away_players p
             where p.event_id = away_events.id and p.person_id in (select public.my_family_ids()))
    or exists (select 1 from public.away_coaches c
             where c.event_id = away_events.id and c.coach_person_id in (select public.my_family_ids()))
  );

drop policy if exists away_coaches_staff on public.away_coaches;
create policy away_coaches_staff on public.away_coaches for all
  using (is_staff(auth.uid())) with check (is_staff(auth.uid()));

-- Les lignes de participation suivent l'événement : qui voit le déplacement
-- voit qui y va. Sans ça, un parent lirait « Bâle » sans savoir avec quel coach.
drop policy if exists away_coaches_concernes on public.away_coaches;
create policy away_coaches_concernes on public.away_coaches for select
  using (exists (select 1 from public.away_events e where e.id = away_coaches.event_id));

drop policy if exists away_players_staff on public.away_players;
create policy away_players_staff on public.away_players for all
  using (is_staff(auth.uid())) with check (is_staff(auth.uid()));

drop policy if exists away_players_concernes on public.away_players;
create policy away_players_concernes on public.away_players for select
  using (exists (select 1 from public.away_events e where e.id = away_players.event_id));

grant select, insert, update, delete on public.away_events  to authenticated;
grant select, insert, update, delete on public.away_coaches to authenticated;
grant select, insert, update, delete on public.away_players to authenticated;
