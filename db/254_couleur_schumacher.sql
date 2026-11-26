-- =====================================================================
-- 254 — Xavier Schumacher : une seule couleur pour ses créneaux
--                                                            26.11.2026
-- =====================================================================
-- Ses séances s'affichaient en TROIS couleurs, ce qui les rendait
-- impossibles à repérer d'un coup d'œil dans la grille :
--   · 82 créneaux en #e5ff00 (le jaune commun à tous les abonnés d'hiver) ;
--   · 23 créneaux SANS couleur, donc en bleu par défaut — les seuls
--     créneaux d'hiver sans couleur de toute la base, sur 1255 : un oubli
--     à la saisie, pas une intention ;
--   · ses 30 cours « Privé Schumacher », déjà en #92400e.
--
-- On retient le BRUN #92400e : c'est déjà la couleur de son type de cours,
-- donc la sienne. Le jaune ne l'aurait pas distingué — il est partagé par
-- 26 noms (Campiche, Gygax, Green Club, TC Lutry, Stade Lausanne…).
--
-- ⚠⚠ LA GARDE QUI COMPTE : `course_id is null`. Xavier Schumacher est aussi
-- coach de 70 cours de l'école (Club 38, Compétition 22, Performance 10),
-- et ceux-là doivent garder la couleur de leur FILIÈRE — c'est elle qu'on
-- lit dans la grille, pas l'identité du coach. En ne touchant que les
-- réservations sans cours rattaché, il est impossible d'en atteindre un :
-- une séance de l'école est toujours un cours. Vérifié après coup — 70
-- cours intacts, 3 couleurs de filière inchangées, 0 autre réservation
-- devenue brune.
--
-- ⚠ Le brun n'est pas posé sur les cours « Privé Schumacher » : la grille
-- prend la couleur du TYPE pour un créneau rattaché à un cours (cf.
-- drawResaGrid), et ce type est déjà brun. Y toucher serait sans effet.
--
-- Retour en arrière : la table `_couleurs_schumacher_avant` garde l'état
-- des 105 lignes (82 jaunes, 23 sans couleur). Pour revenir :
--   update court_bookings b set color = a.color
--     from _couleurs_schumacher_avant a where a.id = b.id;
-- Elle peut être supprimée une fois la couleur validée à l'écran.
-- =====================================================================

create table if not exists _couleurs_schumacher_avant as
select id, color, booking_date, title from court_bookings
where title ilike '%schumacher%' and course_id is null;

update court_bookings set color = '#92400e'
 where title ilike '%schumacher%' and course_id is null;          -- 105 lignes

update plan_template_bookings set color = '#92400e'
 where title ilike '%schumacher%';                                 -- 1 ligne
