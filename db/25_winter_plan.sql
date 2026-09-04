-- 25_winter_plan.sql
-- Onglet « Saison hiver » : planning FIXE des abonnements (pour facturer la saison d'hiver).
-- Grille lundi->vendredi, courts 4/5/6/7/10/11, creneaux d'1h de 08:15 a 21:15 (14 lignes).
-- Une case = un nom (texte libre). Enregistrement automatique.
-- Acces : superadmin / admin / secretaire (facturation / secretariat).
create or replace function public.can_winter(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
    and role in ('superadmin','admin','secretaire'));
$$;

create table if not exists public.winter_plan (
  season text not null,        -- ex. '2026-2027'
  day smallint not null,       -- 1=lundi .. 5=vendredi
  court smallint not null,     -- 4,5,6,7,10,11
  slot smallint not null,      -- 0..13 (08:15 -> 21:15)
  player_name text,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id),
  primary key (season, day, court, slot)
);
alter table public.winter_plan enable row level security;
drop policy if exists winter_plan_rw on public.winter_plan;
create policy winter_plan_rw on public.winter_plan for all
  using (can_winter(auth.uid())) with check (can_winter(auth.uid()));
grant select, insert, update, delete on public.winter_plan to authenticated;
