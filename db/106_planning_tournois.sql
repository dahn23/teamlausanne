-- Planning de saison des jeunes (compétition, performance, sport-études, pro, pro U18) — 26.09.2026.
-- Frise de saison, semaine par semaine, en DOUBLE case :
--   • la SEMAINE : prépa physique / entraînement / entraînement en option / vacances / tournoi à l'étranger (plan_weeks)
--   • le WEEK-END : un ou plusieurs tournois (plan_tournaments), saisis par le staff OU par le jeune depuis Mon espace.
-- Saison de planning = 52 semaines à partir d'un lundi (2026/27 : lundi 31.08.2026 → dimanche 29.08.2027).
-- Droits : head coach, coach, admin, superadmin modifient tout ; le jeune (et ses parents) lisent sa frise ; le jeune
-- ajoute / retire ses propres tournois. Console : onglet « Planning tournois » (prochains tournois regroupés +
-- calendriers). Mon espace : section « Ma saison » de l'onglet Matchs.

create table if not exists public.plan_seasons (
  label text primary key,
  start_monday date not null,
  weeks integer not null default 52 check (weeks between 1 and 60),
  created_at timestamptz not null default now()
);
insert into public.plan_seasons(label, start_monday, weeks) values ('2026/27', '2026-08-31', 52) on conflict (label) do nothing;

create table if not exists public.plan_weeks (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  kind text not null check (kind in ('prepa', 'entrainement', 'option', 'vacances', 'etranger')),
  note text,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (person_id, week_start)
);
create index if not exists plan_weeks_week_idx on public.plan_weeks(week_start);

create table if not exists public.plan_tournaments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  name text not null check (length(btrim(name)) between 2 and 160),
  source text not null default 'staff' check (source in ('staff', 'joueur')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists plan_tournaments_week_idx on public.plan_tournaments(week_start);
create index if not exists plan_tournaments_person_idx on public.plan_tournaments(person_id);

-- Qui planifie : head coach, coach, admin, superadmin.
create or replace function public.can_plan(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role::text in ('head_coach', 'coach', 'admin', 'superadmin'));
$$;
-- Le jeune (filière élite) lié au compte connecté : lui-même, ou son enfant pour un parent.
create or replace function public.plan_is_my_player(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from portal_player_youths() y where y.person_id = pid);
$$;
grant execute on function public.can_plan(uuid), public.plan_is_my_player(uuid) to authenticated;

alter table public.plan_seasons enable row level security;
alter table public.plan_weeks enable row level security;
alter table public.plan_tournaments enable row level security;

drop policy if exists plan_seasons_read on public.plan_seasons;
create policy plan_seasons_read on public.plan_seasons for select to authenticated using (true);
drop policy if exists plan_seasons_admin on public.plan_seasons;
create policy plan_seasons_admin on public.plan_seasons for all to authenticated
  using (exists (select 1 from user_roles where user_id = auth.uid() and role::text in ('admin', 'superadmin')))
  with check (exists (select 1 from user_roles where user_id = auth.uid() and role::text in ('admin', 'superadmin')));

drop policy if exists plan_weeks_read on public.plan_weeks;
create policy plan_weeks_read on public.plan_weeks for select to authenticated
  using (can_plan(auth.uid()) or plan_is_my_player(person_id));
drop policy if exists plan_weeks_write on public.plan_weeks;
create policy plan_weeks_write on public.plan_weeks for all to authenticated
  using (can_plan(auth.uid())) with check (can_plan(auth.uid()));

drop policy if exists plan_tournaments_read on public.plan_tournaments;
create policy plan_tournaments_read on public.plan_tournaments for select to authenticated
  using (can_plan(auth.uid()) or plan_is_my_player(person_id));
drop policy if exists plan_tournaments_insert on public.plan_tournaments;
create policy plan_tournaments_insert on public.plan_tournaments for insert to authenticated
  with check (can_plan(auth.uid()) or (plan_is_my_player(person_id) and source = 'joueur' and created_by = auth.uid()));
drop policy if exists plan_tournaments_change on public.plan_tournaments;
create policy plan_tournaments_change on public.plan_tournaments for update to authenticated
  using (can_plan(auth.uid()) or (source = 'joueur' and created_by = auth.uid() and plan_is_my_player(person_id)))
  with check (can_plan(auth.uid()) or (source = 'joueur' and created_by = auth.uid() and plan_is_my_player(person_id)));
drop policy if exists plan_tournaments_delete on public.plan_tournaments;
create policy plan_tournaments_delete on public.plan_tournaments for delete to authenticated
  using (can_plan(auth.uid()) or (source = 'joueur' and created_by = auth.uid() and plan_is_my_player(person_id)));

grant select, insert, update, delete on public.plan_seasons, public.plan_weeks, public.plan_tournaments to authenticated;
