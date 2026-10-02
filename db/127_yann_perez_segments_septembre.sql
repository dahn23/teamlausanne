-- 127 — Yann Perez, septembre 2026 : deux saisies de segments manquantes.
--
-- Le décompte affichait 101 h alors que ses 58 cours du mois totalisent
-- exactement 104 h de créneaux planifiés. Les 3 heures manquantes se
-- décomposent ainsi :
--
--   • 1er septembre, Sport-Études 08:15-10:15, deux courts, Yann SEUL coach.
--     Le cours est « détaillé » (course_is_detailed : type Pro/Sport-études
--     + plus d'un court), et pour un cours détaillé les heures viennent
--     UNIQUEMENT des segments — la présence ou la validation n'y changent
--     rien. Aucun segment n'avait été saisi : le créneau comptait 0 h.
--     C'est aussi ce cours qui tenait son décompte à 57/58.          -2 h
--
--   • 22 septembre, 14:15-16:15, séance à trois coachs sur trois courts.
--     Mariano et Renato ont 2 h 30 de segments chacun, Yann n'avait qu'une
--     heure saisie sur les deux du créneau.                           -1 h
--
-- On corrige la saisie plutôt que de forcer un total : staff_hours_month
-- recalcule alors 104 h de lui-même, et le détail du cours dit enfin ce qui
-- s'est passé. coach_segment_minutes plafonne de toute façon à la durée du
-- créneau, il n'y a pas de risque de sur-compter.

begin;

-- 1er septembre : le créneau entier.
insert into course_segments (course_id, seq, minutes, coach_person_id, court_id, note, status)
values ('20824cdf-8f5b-4403-8a10-1a70c9fd9afe',
        (select coalesce(max(seq), -1) + 1 from course_segments
          where course_id = '20824cdf-8f5b-4403-8a10-1a70c9fd9afe'),
        120, '044f6a23-0185-4cb8-bade-531f140f8451', 5,
        'Saisie manquante, rattrapée le 02.10.2026 : créneau entier, seul coach.', 'jeu');

-- 22 septembre : la seconde heure.
insert into course_segments (course_id, seq, minutes, coach_person_id, court_id, note, status)
values ('967fa086-8b63-48bc-93c2-c95aef5d7202',
        (select coalesce(max(seq), -1) + 1 from course_segments
          where course_id = '967fa086-8b63-48bc-93c2-c95aef5d7202'),
        60, '044f6a23-0185-4cb8-bade-531f140f8451', 6,
        'Saisie manquante, rattrapée le 02.10.2026 : seconde heure du créneau.', 'jeu');

commit;

-- Contrôle : doit renvoyer 104.00 et 58/58.
-- select c->>'name', c->>'hours', c->>'courses', c->>'total_courses'
--   from jsonb_array_elements(staff_hours_month_brut('2026-09')->'coaches') c
--  where c->>'name' = 'Yann Perez';

-- Puis seulement, la validation du mois :
-- insert into staff_month_validation (person_id, ym, kind, hours, validated_at)
-- values ('044f6a23-0185-4cb8-bade-531f140f8451', '2026-09', 'coach', 104, now())
-- on conflict (person_id, ym, kind) do update
--    set hours = excluded.hours, validated_at = excluded.validated_at;
