-- 28.09.2026 (décision Dan) : la semaine du 5 au 9 octobre 2026 est déjà congé pour le sport-études
-- (semaine « pro », avant les vacances d'automne VD du 10.10). On retire ces 5 jours du calendrier Études 2026/27.
-- Seules des cases « pas prévu » y étaient posées (56), aucune présence réelle.
-- Pas d'ajout dans school_holidays : cette table = vacances scolaires VD, aussi lue par le calendrier d'équipe.
-- ⚠️ Si on relance « Générer » dans Études › Réglages sur cette période, ces jours reviendraient.
delete from etudes_attendance where day_id in (select id from etudes_days where day between '2026-10-05' and '2026-10-09');
delete from etudes_day_profs  where day_id in (select id from etudes_days where day between '2026-10-05' and '2026-10-09');
delete from etudes_day_validation where day_id in (select id from etudes_days where day between '2026-10-05' and '2026-10-09');
delete from etudes_days where day between '2026-10-05' and '2026-10-09';
