-- 229 — Nouveau rôle « senior coach » (06.11.2026)
--
-- Demande : Mark Gattiker doit pouvoir annoter le suivi d'un jeune, comme
-- Mariano Palena. Or ce droit tient à `can_mental()`, qui ne connaissait que
-- superadmin / admin / head_coach / coach_mental. Deux issues existaient, et
-- aucune ne convenait :
--   · faire de Mark un head coach lui ouvrait aussi Prospects (la liste de
--     scouting, qui nomme des mineurs) et, dans Heures, le décompte de TOUTE
--     l'équipe ;
--   · ouvrir can_mental au rôle « coach » donnait le suivi à tous les coachs,
--     présents et futurs, y compris sur des jeunes qu'ils n'entraînent pas.
--
-- D'où une marche intermédiaire, décidée par Raphael : **senior coach**.
--   Suivi du jeune (youth_notes) + Calendrier, Réservations, Anniversaires,
--   Mental. PAS Prospects. PAS la vue d'ensemble des Heures.
--
-- À savoir sur les Heures : l'onglet reste visible pour un senior coach qui
-- est aussi coach — il y lit SES heures, il en a besoin pour être payé. Ce
-- qu'il n'a pas, c'est `isManager` (admin.js), donc le décompte de toute
-- l'équipe. Et les SALAIRES ne dépendent d'aucun de ces rôles : ils demandent
-- admin/superadmin ou l'étiquette CRM « paie » (canSalaries).
--
-- Appliqué en deux temps : Postgres refuse d'utiliser une valeur d'enum dans
-- la transaction qui l'ajoute.

-- 1) la valeur d'enum
alter type public.app_role add value if not exists 'senior_coach';

-- 2) le droit d'écrire dans le fil de suivi
create or replace function public.can_mental(uid uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from user_roles where user_id = uid
     and role in ('superadmin','admin','head_coach','senior_coach','coach_mental'));
$$;

-- 3) un senior coach est du STAFF. Sans cette ligne, quelqu'un qui ne porterait
-- QUE ce rôle serait renvoyé vers Mon espace par landingFor() et traité comme
-- une famille par la RLS. Mark ne le voit pas — il reste coach — mais le piège
-- attendait le suivant. Le pendant côté front est STAFF_ROLES, dans common.js.
create or replace function public.is_staff(uid uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from user_roles where user_id = uid
     and role in ('superadmin','admin','secretaire','head_coach','senior_coach','coach','coach_physique','moniteur'));
$$;

-- 4) Mark Gattiker. Les DEUX tables : user_roles porte l'accès réel, lu par la
-- RLS ; person_roles porte l'étiquette de la fiche. Enregistrer la fiche
-- rejoue syncAccessRoles (person_roles → user_roles) et EFFACE ce qui n'a pas
-- son étiquette : sans la ligne person_roles, le droit disparaîtrait au
-- premier enregistrement de sa fiche, sans que personne ne comprenne pourquoi.
insert into user_roles (user_id, role)
values ('8428df63-f5da-46d3-8622-902e60a6236c', 'senior_coach')   -- mgattiker@hotmail.com
on conflict do nothing;

insert into person_roles (person_id, role)
values ('740c4eba-12a4-461a-8851-06e811ba5de5', 'senior-coach')   -- Mark Gattiker
on conflict do nothing;

-- Vérification :
--   select can_mental('8428df63-f5da-46d3-8622-902e60a6236c'),
--          is_staff  ('8428df63-f5da-46d3-8622-902e60a6236c');
