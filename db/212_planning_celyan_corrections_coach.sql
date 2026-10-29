-- 212 — Deux corrections du coach sur la saison de Célyan (29.10.2026).
--
-- db/211 avait lu le fichier au pied de la lettre. Deux lectures étaient
-- fausses, et c'est le coach qui tranche :
--
--   • 04.01.2027 — le fichier annonce « Reprise du tennis ». Pour le groupe
--     sport-études, c'est encore des vacances : leur rentrée ne tombe pas sur
--     la même semaine. La semaine repart donc en vacances de Noël, comme
--     avant.
--
--   • 17.05, 24.05 et 21.06.2027 — j'avais lu « Bloc de travail » comme un
--     bloc de préparation physique, par analogie avec les semaines de mars.
--     Ce sont des semaines d'entraînement : le tennis y est complet, seul le
--     week-end est libre de compétition. Le contenu ne bouge pas, uniquement
--     la couleur de la frise.

begin;

update plan_weeks
   set kind = 'vacances', tennis = 'Vacances de Noël', physique = 'Repos',
       note = null, updated_at = now()
 where person_id = '333cb7e9-d090-4052-a741-041abcaec015'
   and week_start = '2027-01-04';

update plan_weeks
   set kind = 'entrainement', updated_at = now()
 where person_id = '333cb7e9-d090-4052-a741-041abcaec015'
   and week_start in ('2027-05-17', '2027-05-24', '2027-06-21');

commit;
