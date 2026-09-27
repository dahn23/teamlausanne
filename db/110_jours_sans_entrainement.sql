-- Jours fériés / sans entraînement (27.09.2026, demande Dan) : une encoche sur la semaine dans la frise de saison
-- (console › Planning tournois et Mon espace › Saison), et le détail dans la semaine.
-- Dates absolues (pas liées à une saison) : chaque frise affiche celles qui tombent dans ses 52 semaines.
-- Lecture : tout compte connecté (les jeunes les voient) ; écriture : head coach, coach, admin, superadmin (can_plan).

create table if not exists public.plan_days_off (
  day date primary key,
  label text not null check (length(btrim(label)) between 2 and 80),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.plan_days_off enable row level security;
drop policy if exists plan_days_off_read on public.plan_days_off;
create policy plan_days_off_read on public.plan_days_off for select to authenticated using (true);
drop policy if exists plan_days_off_write on public.plan_days_off;
create policy plan_days_off_write on public.plan_days_off for all to authenticated
  using (can_plan(auth.uid())) with check (can_plan(auth.uid()));
grant select, insert, update, delete on public.plan_days_off to authenticated;

-- Saison 2026/27 (décision Dan) : pas d'entraînement ces jours-là. Le vendredi après l'Ascension, on s'entraîne.
insert into public.plan_days_off(day, label) values
  ('2026-09-21', 'Lundi du Jeûne fédéral'),
  ('2026-12-24', 'Veille de Noël'),
  ('2026-12-25', 'Noël'),
  ('2027-03-26', 'Vendredi saint'),
  ('2027-03-29', 'Lundi de Pâques'),
  ('2027-05-06', 'Ascension'),
  ('2027-05-17', 'Lundi de Pentecôte')
on conflict (day) do nothing;
