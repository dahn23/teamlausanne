-- Annonces d'absence / de retard, saisies AVANT le cours.
--
-- Les parents écrivent au secrétariat (« Léa sera en retard, rendez-vous chez le
-- médecin »). Jusqu'ici ça se perdait : rien dans la console ne permettait de le
-- noter, et le coach arrivait au cours sans le savoir.
--
-- Pourquoi une table à part plutôt que de pointer la présence à l'avance :
--   · l'appel (attendance) est le constat du coach — qui était là, qui ne l'était
--     pas. Une annonce est une information reçue avant, qui peut se démentir :
--     l'enfant annoncé absent peut finalement venir.
--   · l'alerte du tableau de bord compte les absences pour dire « appelle les
--     parents ». Une absence annoncée est précisément celle où il ne faut PAS
--     appeler : la mélanger au constat rendrait l'alerte trompeuse.
--   · le message du parent se garde ici, avec l'annonce. L'appel n'a pas de
--     place pour ça.
--
-- Une annonce par enfant et par cours : une deuxième remplace la première
-- (le parent qui rappelle pour dire « finalement il vient » corrige la note).

create table if not exists public.course_notices (
  course_id  uuid not null references public.courses(id) on delete cascade,
  person_id  uuid not null references public.people(id)  on delete cascade,
  kind       text not null,
  note       text,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (course_id, person_id),
  constraint course_notices_kind check (kind in ('absent','retard'))
);
create index if not exists course_notices_course on public.course_notices (course_id);

-- Qui peut annoncer : l'équipe administrative. Le secrétariat en fait partie —
-- c'est lui qui reçoit les messages des parents — alors qu'il n'a pas le droit
-- de faire l'appel (is_head l'exclut, et c'est très bien : l'appel appartient
-- au coach).
create or replace function public.can_annonce(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles
     where user_id = uid and role in ('superadmin','admin','head_coach','secretaire'));
$$;

alter table public.course_notices enable row level security;

-- Lecture ouverte à tout compte connecté : le coach du cours doit la voir, et
-- c'est le but même de l'annonce.
drop policy if exists cn_lecture on public.course_notices;
create policy cn_lecture on public.course_notices for select to authenticated using (true);

drop policy if exists cn_ecriture on public.course_notices;
create policy cn_ecriture on public.course_notices for all to authenticated
  using (can_annonce(auth.uid())) with check (can_annonce(auth.uid()));

grant select, insert, update, delete on public.course_notices to authenticated;
revoke all on function public.can_annonce(uuid) from public, anon;
grant execute on function public.can_annonce(uuid) to authenticated;
