-- ===================================================================
--  SÉCURITÉ : ses cours, ses enfants (16.10.2026)
-- ===================================================================
-- db/173 a fermé les domaines dont un coach n'a pas l'onglet. Restait le cœur
-- de la demande : « leurs cours, les enfants de leurs cours, et rien d'autre ».
-- Or trois tables donnaient le club entier :
--
--   people                1 225   toutes les fiches, adresses et e-mails
--   attendance            2 356   toutes les présences de tous les cours
--   course_participants   2 213   qui est inscrit dans quel cours
--
-- Et pour les deux dernières, la policy de lecture était `true` : non pas
-- « tout le staff », mais TOUT COMPTE CONNECTÉ. Un parent ou un junior les
-- lisait aussi. Moins grave qu'il n'y paraît — sans accès à people, il n'en
-- tire que des identifiants, pas des noms — mais il n'y a aucune raison de
-- laisser cela ouvert.
--
-- Le portail membre n'est PAS concerné : espace.js ne lit aucune de ces trois
-- tables en direct, il passe uniquement par les fonctions portal_*
-- (SECURITY DEFINER), qui gardent leurs propres règles.
--
-- RÈGLE POSÉE ICI :
--
--   · admin, secrétariat, head coach   → tout, comme avant
--   · coach, coach physique, moniteur  → les cours où ils sont inscrits comme
--                                        coach, et les enfants de ces cours
--   · chacun                           → sa propre fiche
--
-- Les noms des COLLÈGUES restent lisibles : la grille du planning affiche qui
-- donne quel cours, et un coach doit pouvoir lire « Elisa » sur le cours
-- d'à côté. Ce sont des noms d'encadrants, pas des données d'enfants.

-- ---- Suis-je coach de ce cours ? -----------------------------------
create or replace function public.coach_of_course(p_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from course_coaches cc
      join profiles pr on pr.person_id = cc.coach_person_id
     where cc.course_id = p_course and pr.user_id = auth.uid());
$$;
revoke all on function public.coach_of_course(uuid) from public, anon;
grant execute on function public.coach_of_course(uuid) to authenticated;

-- Qui voit tout le fichier : direction, secrétariat, head coach.
create or replace function public.can_read_all_people(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
     and role in ('superadmin','admin','secretaire','head_coach'));
$$;
revoke all on function public.can_read_all_people(uuid) from public, anon;
grant execute on function public.can_read_all_people(uuid) to authenticated;

-- ---- people --------------------------------------------------------
alter policy people_read_staff on public.people
  using (can_read_all_people(auth.uid()));

-- Les enfants de MES cours. Policies permissives : celle-ci s'ajoute à
-- people_read_self (sa propre fiche) et à people_read_staff ci-dessus.
drop policy if exists people_read_mes_joueurs on public.people;
create policy people_read_mes_joueurs on public.people
  for select using (
    exists (
      select 1
        from course_participants cp
        join course_coaches cc on cc.course_id = cp.course_id
        join profiles pr       on pr.person_id = cc.coach_person_id
       where cp.child_person_id = people.id
         and pr.user_id = auth.uid())
  );

-- Les collègues de l'encadrement : des noms d'adultes, affichés sur la grille.
drop policy if exists people_read_collegues on public.people;
create policy people_read_collegues on public.people
  for select using (
    is_staff(auth.uid())
    and exists (
      select 1 from profiles p2
        join user_roles r on r.user_id = p2.user_id
       where p2.person_id = people.id
         and r.role in ('superadmin','admin','secretaire','head_coach','coach',
                        'coach_physique','moniteur','prof','coach_mental'))
  );

-- ---- attendance ----------------------------------------------------
-- Lecture `true` remplacée : les siennes, celles de ses cours, ou tout pour la
-- direction. L'écriture reste inchangée (is_head) — on ne touche pas à qui
-- peut poser une présence.
drop policy if exists att_read on public.attendance;
create policy att_read on public.attendance
  for select using (
    can_read_all_people(auth.uid())
    or coach_of_course(course_id)
    or person_id in (select p.person_id from profiles p where p.user_id = auth.uid())
  );

-- ---- course_participants -------------------------------------------
drop policy if exists cp_read on public.course_participants;
create policy cp_read on public.course_participants
  for select using (
    can_read_all_people(auth.uid())
    or coach_of_course(course_id)
    or child_person_id in (select p.person_id from profiles p where p.user_id = auth.uid())
  );

-- ---- Les index qui rendent tout cela tenable -----------------------
-- Sans eux, chaque ligne de people déclenche un parcours complet de
-- course_participants : la fiche de 1 225 personnes deviendrait un écran qui
-- rame, et un écran qui rame finit par être contourné.
create index if not exists cp_enfant_idx   on public.course_participants (child_person_id);
create index if not exists cp_cours_idx    on public.course_participants (course_id);
create index if not exists cc_cours_idx    on public.course_coaches (course_id);
create index if not exists cc_coach_idx    on public.course_coaches (coach_person_id);
create index if not exists att_cours_idx   on public.attendance (course_id);
create index if not exists profiles_user_idx on public.profiles (user_id);
