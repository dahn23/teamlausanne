-- 128 — Clôture des heures de septembre 2026 : ce qui a été corrigé, et
--       surtout ce qui ne devait PAS l'être.
--
-- La fraction du tableau Heures est « cours confirmés / cours donnés ». Un
-- cours non confirmé compte pour ZÉRO heure (voir staff_hours_month_brut).
-- Tentation : valider tout ce qui traîne pour « remettre à niveau ». Vérification
-- faite, ce serait payer quatre coachs pour des cours qu'ils n'ont pas donnés.
--
-- Méthode : pour chaque cours non confirmé, regarder qui est marqué PRÉSENT en
-- tant que coach, et qui a fait l'appel des élèves (attendance.marked_by).
-- Le remplaçant se trahit tout seul.
--
--   Mathieu Barbey (17/22) — les cinq sont justes. Quatre sont des absences
--     saisies À L'AVANCE par Raphael le 8 septembre, avec remplaçant présent
--     (Loris Gander ×3, Rémi Moha, Célyan Lorival) ; la cinquième, le
--     4 septembre, Mathieu s'est marqué absent lui-même le soir même.
--     14 h 45 est le bon chiffre.
--
--   Elisa Rigazio (42/45) — les trois sont justes. Elle s'est marquée absente
--     elle-même le 25 au matin sur les deux cours du 24 (Talia Picci puis
--     Mathieu Barbey l'ont remplacée) ; le troisième, 24 septembre 18h15, n'a
--     aucune ligne de coach ni aucun élève pointé : il n'a pas eu lieu.
--     38 h 15 est le bon chiffre.
--
--   David Dali (35/38) — à trancher avec lui. Les trois cours du 30 septembre
--     ont un autre coach présent qui a fait l'appel (Talia Picci, puis Vladimir
--     Stojkovic ×2), mais AUCUNE absence n'a été saisie pour David. Les données
--     ne disent pas s'il était là en second. Rien touché.
--
--   Andreas Egger (41/42) — le seul vrai oubli, corrigé ci-dessous.

begin;

-- Andreas Egger, 10 septembre 10h15-11h15. Seul coach du cours, il a pointé
-- ses 4 élèves mais n'a jamais coché sa propre ligne. Aucun remplaçant.
insert into course_validation (course_id, coach_person_id)
select c.id, pe.id
from courses c
cross join people pe
where c.course_date = '2026-09-10' and c.start_time = '10:15'
  and pe.first_name = 'Andreas' and pe.last_name = 'Egger'
  and exists (select 1 from course_coaches cc
               where cc.course_id = c.id and cc.coach_person_id = pe.id)
on conflict do nothing;
-- → 42/42, 42 h 00

-- Xavier Schumacher : mois arrêté à 28 h sur demande de Raphael. Il reste à
-- 26/27 — le cours du lundi 14 septembre 17h15-19h15 n'est pas confirmé et ne
-- doit pas l'être : le valider ajouterait 2 h et le porterait à 30.
insert into staff_month_validation (person_id, ym, kind, hours, validated_at)
select id, '2026-09', 'coach', 28, now() from people
where first_name = 'Xavier' and last_name = 'Schumacher'
on conflict (person_id, ym, kind) do update
   set hours = excluded.hours, validated_at = excluded.validated_at;

commit;
