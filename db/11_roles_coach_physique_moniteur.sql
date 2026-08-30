-- 11_roles_coach_physique_moniteur.sql
-- Deux nouveaux roles "comme coach" mais avec moins d'onglets :
--   coach_physique : PAS de feuilles de match (onglet matchs). Onglets : cours, phystests, heures.
--   moniteur       : PAS de feuilles de match NI de tests physiques. Onglets : cours, heures.
-- Attribues (a la place de coach) :
--   coach_physique = Andreas Egger, Remi Moha
--   moniteur       = Mathieu Barbey, Celyan Lorival, Talia Picci, Seline Rivaroli
-- Migrations Supabase : add_roles_coach_physique_moniteur (enum) + assign_coach_physique_moniteur.

-- 1) enum (migration separee, contrainte Postgres : ne pas utiliser la valeur dans la meme tx)
alter type app_role add value if not exists 'coach_physique';
alter type app_role add value if not exists 'moniteur';

-- 2) is_staff inclut les nouveaux roles (acces staff comme coach)
create or replace function public.is_staff(uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from user_roles where user_id = uid
     and role in ('superadmin','admin','secretaire','head_coach','coach','coach_physique','moniteur'));
$$;

-- 3) attributions (person_roles = text ; user_roles = enum) : voir migration.
-- 4) reglage stocke app_settings.tab_access : ajouter les cles
--    coach_physique -> ["cours","phystests","heures"] ; moniteur -> ["cours","heures"].
--
-- Cote front (admin.js/common.js) : STAFF_ROLES, CONSOLE_ROLES, COACH_ROLES, ROLE_LIST,
-- ASSIGNABLE_ROLES, PERSON_ROLES, ME_ROLE_LABELS, ACCESS_SYNC_ROLES, DEFAULT_TAB_ACCESS,
-- entete "Espace coach" -> incluent coach_physique + moniteur.
