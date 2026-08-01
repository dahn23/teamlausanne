-- =====================================================================
--  ACADÉMIE DE TENNIS — Règles de sécurité (RLS) par rôle — Couche 1
--  Principe : moindre privilège. Données mineurs + perso protégées.
--  - Inventaire des courts : lisible par tout compte connecté.
--  - Réservations : visibles par tous les connectés (dispo du club) ;
--    chacun crée/modifie/supprime les siennes ; le staff gère tout.
--  - Fichier 'people' : lisible par le staff + sa propre fiche.
-- =====================================================================

-- ---- Helpers de rôle (au-dessus de has_role) ----
create or replace function is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles
                 where user_id = uid and role in ('superadmin','admin'));
$$;

create or replace function is_staff(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles
                 where user_id = uid
                   and role in ('superadmin','admin','secretaire','head_coach','coach'));
$$;

-- =====================================================================
--  COURTS  (inventaire non sensible)
-- =====================================================================
drop policy if exists courts_read      on courts;
drop policy if exists courts_admin_all on courts;

create policy courts_read on courts
  for select to authenticated using (true);

create policy courts_admin_all on courts
  for all to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- =====================================================================
--  COURT_BOOKINGS
--   - lecture : tout connecté (voir la dispo)
--   - création : tout connecté, doit se marquer comme créateur
--   - modif/suppr : le créateur ou le staff
-- =====================================================================
drop policy if exists cb_read        on court_bookings;
drop policy if exists cb_insert_self on court_bookings;
drop policy if exists cb_update_own  on court_bookings;
drop policy if exists cb_delete_own  on court_bookings;

create policy cb_read on court_bookings
  for select to authenticated using (true);

create policy cb_insert_self on court_bookings
  for insert to authenticated
  with check (created_by = auth.uid());

create policy cb_update_own on court_bookings
  for update to authenticated
  using (created_by = auth.uid() or is_staff(auth.uid()))
  with check (created_by = auth.uid() or is_staff(auth.uid()));

create policy cb_delete_own on court_bookings
  for delete to authenticated
  using (created_by = auth.uid() or is_staff(auth.uid()));

-- =====================================================================
--  PEOPLE  (sensible : membres, mineurs, parents)
--   - lecture : staff (tout) + sa propre fiche liée
--   - écriture : admin + secrétariat
-- =====================================================================
drop policy if exists people_read_staff on people;
drop policy if exists people_read_self  on people;
drop policy if exists people_write      on people;

create policy people_read_staff on people
  for select to authenticated using (is_staff(auth.uid()));

create policy people_read_self on people
  for select to authenticated
  using (id in (select person_id from profiles where user_id = auth.uid()));

create policy people_write on people
  for all to authenticated
  using (is_admin(auth.uid())
         or has_role(auth.uid(),'secretaire'))
  with check (is_admin(auth.uid())
         or has_role(auth.uid(),'secretaire'));

-- =====================================================================
--  PROFILES / USER_ROLES  (chacun voit le sien ; admin gère tout)
-- =====================================================================
drop policy if exists profiles_self on profiles;
drop policy if exists profiles_admin on profiles;
create policy profiles_self on profiles
  for select to authenticated
  using (user_id = auth.uid() or is_admin(auth.uid()));
create policy profiles_admin on profiles
  for all to authenticated
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

drop policy if exists roles_self on user_roles;
drop policy if exists roles_admin on user_roles;
create policy roles_self on user_roles
  for select to authenticated
  using (user_id = auth.uid() or is_admin(auth.uid()));
create policy roles_admin on user_roles
  for all to authenticated
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- =====================================================================
--  GUARDIANSHIPS / LESSONS / LESSON_ENROLLMENTS
--   Couche 1 : lecture staff, écriture staff. (à affiner Couche 2)
-- =====================================================================
drop policy if exists guardianships_staff on guardianships;
create policy guardianships_staff on guardianships
  for all to authenticated
  using (is_staff(auth.uid())) with check (is_staff(auth.uid()));

drop policy if exists lessons_read on lessons;
drop policy if exists lessons_write on lessons;
create policy lessons_read on lessons
  for select to authenticated using (true);
create policy lessons_write on lessons
  for all to authenticated
  using (is_staff(auth.uid())) with check (is_staff(auth.uid()));

drop policy if exists enroll_read on lesson_enrollments;
drop policy if exists enroll_write on lesson_enrollments;
create policy enroll_read on lesson_enrollments
  for select to authenticated using (true);
create policy enroll_write on lesson_enrollments
  for all to authenticated
  using (is_staff(auth.uid())) with check (is_staff(auth.uid()));
