-- 46_lockers.sql
-- Onglet « Casiers » (vestiaires) : une ligne par casier, par vestiaire (H = hommes, F = femmes).
-- Champs : nom, e-mail, date, payé. Accès : superadmin / admin / secrétaire (même règle que Saison hiver).
-- Hommes : n° 21-36 et 75-144, sans le 116 ni le 129. Femmes : liste à venir.
create table if not exists public.lockers (
  id uuid primary key default gen_random_uuid(),
  gender text not null check (gender in ('H','F')),
  number int not null,
  name text, email text, date date, paid boolean not null default false, note text,
  updated_at timestamptz not null default now(), updated_by uuid,
  unique (gender, number)
);
alter table public.lockers enable row level security;
drop policy if exists lockers_staff on public.lockers;
create policy lockers_staff on public.lockers for all
  using (can_winter(auth.uid())) with check (can_winter(auth.uid()));
grant select, insert, update, delete on public.lockers to authenticated;

insert into public.lockers (gender, number)
select 'H', n from generate_series(21, 36) n
union all select 'H', n from generate_series(75, 144) n where n not in (116, 129)
on conflict (gender, number) do nothing;
