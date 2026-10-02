-- 129 — Heures de septembre 2026 : les validations restantes.
--
-- NON APPLIQUÉ : l'écriture a été refusée par le garde-fou (ressource
-- partagée). À passer tel quel, ou à faire depuis la console.
--
-- Trois coachs dont les cours non confirmés présentent tous le même profil :
-- seul coach sur le cours, élèves inscrits, aucune absence saisie, aucun
-- remplaçant présent, appel simplement pas fait. C'est le cas d'Andreas Egger
-- (déjà corrigé en db/128), pas celui de Mathieu Barbey ni d'Elisa Rigazio,
-- dont les absences sont documentées.
--
--   Ivan Du Pasquier  13/20 — bloc fixe du mercredi 13h15-17h15, toutes les
--     semaines de septembre, seul coach. L'appel est fait les 2, 9 et 16, puis
--     s'arrête : le 30 septembre aucun des quatre cours n'est pointé alors que
--     des élèves y sont inscrits.                          7 h × 70.– = 490.–
--
--   Anastasia Radovanovic 1/2 — 3 septembre 18h15, seule coach,
--     deux élèves inscrits, appel non fait.                 1 h × 40.– =  40.–
--
--   Mariano Palena 81/93 — douze leçons privées, seul coach, un élève inscrit
--     chacune. Salarié : aucun effet sur la paie, seulement sur le suivi.
--
-- Le filtre sur les inscrits n'est pas cosmétique : il écarte le créneau du
-- 16 septembre 13h15 d'Ivan, qui n'a AUCUN élève inscrit et n'a donc
-- vraisemblablement pas eu lieu. Ivan restera à 19/20 — à confirmer avec lui.

begin;

insert into course_validation (course_id, coach_person_id)
select c.id, cc.coach_person_id
from courses c
join course_coaches cc on cc.course_id = c.id
join people pe on pe.id = cc.coach_person_id
left join course_validation v on v.course_id = c.id and v.coach_person_id = cc.coach_person_id
where to_char(c.course_date, 'YYYY-MM') = '2026-09'
  and course_counts_standard(c.id)
  and (pe.first_name, pe.last_name) in
      (('Ivan','Du Pasquier'), ('Anastasia','Radovanovic'), ('Mariano','Palena'))
  and (select count(*) from course_participants cp where cp.course_id = c.id) > 0
  and not (case when course_is_detailed(c.id)
                then exists (select 1 from course_segments s where s.course_id = c.id)
                else (exists (select 1 from attendance a
                               where a.course_id = c.id and a.person_id = cc.coach_person_id
                                 and a.is_coach and a.status = 'present')
                      or v.course_id is not null) end)
on conflict do nothing;

commit;

-- ---------------------------------------------------------------------------
-- Ce qui ne pourra JAMAIS afficher le ✓, et pourquoi ce n'est pas grave.
--
-- Le ✓ exige cours confirmés = cours donnés (paieBlocages dans admin.js).
-- Or une absence ne retire pas le cours du total : un coach légitimement
-- remplacé reste donc à 17/22 pour toujours. Mathieu Barbey, Elisa Rigazio,
-- Talia Picci et Xavier Schumacher sont dans ce cas, à juste titre.
--
-- Ce n'est pas bloquant : seul « sans tarif horaire » empêche vraiment la
-- clôture, et il n'y en a aucun en septembre. Les cours non confirmés ne sont
-- qu'un avertissement, le bouton Clôturer fonctionne.
--
-- Si l'on voulait vraiment un tableau tout vert, il faudrait retirer le coach
-- remplacé de course_coaches sur les cours qu'il n'a pas donnés — le cours
-- appartiendrait alors à celui qui l'a assuré. C'est défendable, mais cela
-- réécrit le planning passé : à décider, pas à faire en passant.
