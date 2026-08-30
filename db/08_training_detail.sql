-- 08_training_detail.sql
-- Detail des seances (pro / sport-etudes) : le head coach decoupe la seance en
-- BLOCS (duree + coach + court + joueurs) pour, en fin d'annee, sortir combien de
-- fois chaque paire de joueurs s'est retrouvee ensemble, avec quel coach, etc.
-- Tables SEPAREES : lisibles/ecrites uniquement par head_coach + admin/superadmin.
-- Les jeunes et les autres coachs ne voient rien -> l'affichage des cours reste inchange.

create table if not exists public.course_segments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  seq int not null default 0,
  minutes int not null check (minutes > 0),
  coach_person_id uuid references public.people(id),
  court_id smallint references public.courts(id),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);
create index if not exists idx_course_segments_course on public.course_segments(course_id);

create table if not exists public.course_segment_players (
  segment_id uuid not null references public.course_segments(id) on delete cascade,
  person_id  uuid not null references public.people(id),
  primary key (segment_id, person_id)
);
create index if not exists idx_csp_person on public.course_segment_players(person_id);

alter table public.course_segments        enable row level security;
alter table public.course_segment_players enable row level security;

-- Head coach OU admin/superadmin (is_admin couvre admin+superadmin)
drop policy if exists cs_head  on public.course_segments;
drop policy if exists csp_head on public.course_segment_players;
create policy cs_head on public.course_segments for all
  using (is_admin(auth.uid()) or has_role(auth.uid(),'head_coach'))
  with check (is_admin(auth.uid()) or has_role(auth.uid(),'head_coach'));
create policy csp_head on public.course_segment_players for all
  using (is_admin(auth.uid()) or has_role(auth.uid(),'head_coach'))
  with check (is_admin(auth.uid()) or has_role(auth.uid(),'head_coach'));
