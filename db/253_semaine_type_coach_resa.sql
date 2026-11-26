-- =====================================================================
-- 253 — SEMAINE TYPE : un coach sur une réservation hors cours
--                                                            26.11.2026
-- =====================================================================
-- Le bloc « Heures des coachs » d'une semaine type ne comptait que les
-- COURS. Or une partie des leçons est posée comme réservation de court, pas
-- comme cours — typiquement celles qui ne sont pas encore arrêtées, notées
-- « A confirmer / Mege » dans l'intitulé. Resultat : Quentin Mège affichait
-- 12 h alors que 15 h de plus portaient son nom ailleurs dans la grille. Un
-- total faux est pire qu'une absence de total : c'est sur lui qu'on décide.
--
-- D'où deux colonnes, et DEUX, parce que trois situations se distinguent :
--   · `coach_person_id` renseigné  → le créneau compte sur la ligne de ce
--     coach, comme un cours ;
--   · `coach_a_confirmer` seul     → c'est une leçon, mais on ne sait pas
--     encore qui la donne : elle compte sur une ligne « À confirmer » ;
--   · ni l'un ni l'autre            → ce n'est pas une leçon (abonné d'hiver,
--     club, locataire) : elle ne compte nulle part.
-- Les deux peuvent être vraies ensemble : « probablement Mège, à confirmer ».
--
-- ⚠ POURQUOI PAS UNE LECTURE DE L'INTITULÉ. Deviner le coach en cherchant
-- son nom dans le titre marcherait aujourd'hui et mentirait demain : une
-- faute de frappe, un homonyme, un « Mege » qui désigne le joueur et non le
-- coach, et l'heure se pose sur la mauvaise ligne sans que rien ne le dise.
-- Un champ se renseigne et se relit ; une chaîne de caractères se devine.
--
-- ⚠ Ces colonnes ne servent QU'AU BROUILLON. `court_bookings` n'a pas de
-- coach : une réservation appliquée reste une réservation, et l'information
-- demeure dans l'intitulé comme aujourd'hui. C'est un outil pour juger la
-- charge AVANT de poser la semaine, pas une nouvelle donnée de paie.
-- =====================================================================

alter table plan_template_bookings
  add column if not exists coach_person_id   uuid references people(id) on delete set null,
  add column if not exists coach_a_confirmer boolean not null default false;

-- Rattrapage des lignes déjà saisies à la main dans l'intitulé (une fois,
-- sur des titres connus — ce n'est pas une règle, c'est une reprise).
update plan_template_bookings
   set coach_person_id = (select id from people
                          where first_name = 'Quentin' and last_name = 'Mege' limit 1),
       coach_a_confirmer = true
 where title ilike '%confirmer%' and title ilike '%mege%'
   and coach_person_id is null;

update plan_template_bookings
   set coach_a_confirmer = true
 where title ilike '%confirmer%' and coach_person_id is null
   and coach_a_confirmer = false;
