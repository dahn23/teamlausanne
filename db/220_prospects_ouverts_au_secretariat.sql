-- 220_prospects_ouverts_au_secretariat.sql
-- Prospects : tout l'onglet s'ouvre au secrétariat, pas seulement Visibilité.
--
-- db/219 avait ouvert le seul sous-onglet Visibilité au secrétariat, en
-- gardant le scouting des joueurs fermé. Décision de Dan (03.11.2026) : qu'ils
-- voient l'onglet entier. Arsalan et Séline portent le rôle `secretaire`.
--
-- Sans cette migration, l'interface aurait affiché les trois autres
-- sous-onglets et la RLS les aurait servis VIDES — le pire des deux mondes :
-- un écran qui ment sur ce qu'il contient.
--
-- Ce que ça ouvre réellement, et qu'il faut avoir en tête :
--   · `prospects` / `prospect_matches` — des mineurs repérés en tournoi
--     (nom, année, club, classement, et leurs coordonnées quand elles ont été
--     récupérées une par une depuis le portail des licences) ;
--   · `prospect_followups` / `prospect_events` — les familles en discussion
--     avec l'académie, et tout ce qui s'est dit avec elles.
-- Le secrétariat voit déjà le Répertoire complet : l'écart reste cohérent.
--
-- Pas touché : `gz_config`, qui porte la clé d'import des bookmarklets. Le
-- sous-onglet « Import / outils » affichera donc « Clé d'import indisponible »
-- pour qui n'a pas aussi GameZone — c'est un travail d'administration, et la
-- clé n'a pas à circuler pour autant.

create or replace function public.can_prospects(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
     and role in ('superadmin','admin','head_coach','secretaire'));
$$;

-- Le Suivi des familles suivait `is_admin` seul : le secrétariat le rejoint.
drop policy if exists pf_admin on public.prospect_followups;
create policy pf_admin on public.prospect_followups for all
  using (can_prospects(auth.uid())) with check (can_prospects(auth.uid()));

drop policy if exists pe_admin on public.prospect_events;
create policy pe_admin on public.prospect_events for all
  using (can_prospects(auth.uid())) with check (can_prospects(auth.uid()));
