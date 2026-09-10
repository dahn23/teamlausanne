-- 56_role_affichage_policies.sql
-- Suite de 55. Deux policies, pas une de plus.

-- 1. Nommer les coachs dans la grille. admin.js resout coach_person_id -> nom
--    de famille via le cache people ; sans lecture, la grille afficherait
--    « Coach » (repli deja prevu). La policy est volontairement etroite :
--    uniquement les personnes taguees coach. Un poste en libre acces ne peut
--    donc lire aucune fiche de jeune.
drop policy if exists people_read_affichage on public.people;
create policy people_read_affichage on public.people for select
  using (has_role(auth.uid(), 'affichage') and has_person_role(id, 'coach'));

-- 2. Fermer le seul trou en ecriture. cb_insert_self autorise TOUT compte
--    connecte a creer une reservation — c'est ainsi que les membres reservent.
--    On en exclut affichage, sans toucher au reste du comportement.
drop policy if exists cb_insert_self on public.court_bookings;
create policy cb_insert_self on public.court_bookings for insert
  with check (created_by = auth.uid() and not has_role(auth.uid(), 'affichage'));
