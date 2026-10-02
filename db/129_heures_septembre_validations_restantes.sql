-- 129 — Heures de septembre 2026 : les dernières validations.
--       APPLIQUÉ le 02.10.2026 sur accord de Raphael.
--
-- Ivan Du Pasquier, 13/20 → 19/20, 13 h → 19 h.
--
-- Ses sept cours non confirmés présentaient le même profil qu'Andreas Egger
-- (db/128) : seul coach, aucune absence saisie, aucun remplaçant présent,
-- appel simplement pas fait. C'est un bloc fixe du mercredi 13h15-17h15, quatre
-- leçons d'affilée, toutes les semaines de septembre. L'appel est fait les 2,
-- 9 et 16, puis s'arrête : le 30 septembre, aucun des quatre cours n'est pointé
-- alors que des élèves y sont inscrits.
--
-- Ivan est « sur facture » : ces heures ne passent donc pas par la fiduciaire,
-- elles fixent le montant attendu sur SA facture — 1 330.– au lieu de 910.–.
--
-- SIX cours sur sept, et non sept : le créneau du 16 septembre 13h15 n'a aucun
-- élève inscrit ni aucun pointage, et Raphael a tranché qu'on ne valide pas un
-- cours sans élève. Ivan reste donc à 19/20 — c'est volontaire, ce n'est pas un
-- oubli à rattraper.

begin;

insert into course_validation (course_id, coach_person_id)
select c.id, cc.coach_person_id
from courses c
join course_coaches cc on cc.course_id = c.id
join people pe on pe.id = cc.coach_person_id
left join course_validation v on v.course_id = c.id and v.coach_person_id = cc.coach_person_id
where to_char(c.course_date, 'YYYY-MM') = '2026-09'
  and course_counts_standard(c.id)
  and pe.first_name = 'Ivan' and pe.last_name = 'Du Pasquier'
  -- Pas de validation d'un cours sans aucun élève inscrit : rien n'y indique
  -- qu'il a eu lieu. Écarte le 16 septembre 13h15.
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
-- Laissés en l'état, volontairement :
--
--   Anastasia Radovanovic 1/2 — décision de Raphael, on n'y touche pas.
--   Mariano Palena       81/93 — salarié, reste dans le décompte avec son brut ;
--                                ses heures n'ont aucun effet sur la paie.
--   Nabil Ftiss (prof)     4/5 — il était absent le 22 septembre. J'avais validé
--                                cette journée à tort, en déduisant sa présence
--                                des onze élèves pointés : c'était une mauvaise
--                                inférence, quelqu'un d'autre les avait pointés.
--                                Annulé, il est bien à 16 h.
--
-- ---------------------------------------------------------------------------
-- Ce qui ne pourra JAMAIS afficher le ✓, et pourquoi ce n'est pas grave.
--
-- Le ✓ exige cours confirmés = cours donnés (paieBlocages dans admin.js). Or
-- une absence ne retire pas le cours du total : un coach légitimement remplacé
-- reste donc à 17/22 pour toujours. Mathieu Barbey, Elisa Rigazio, Talia Picci
-- et Xavier Schumacher sont dans ce cas, à juste titre.
--
-- Ce n'est pas bloquant : seul « sans tarif horaire » empêche vraiment la
-- clôture, et il n'y en a aucun en septembre. Les cours non confirmés ne sont
-- qu'un avertissement, le bouton Clôturer fonctionne.
--
-- Si l'on voulait vraiment un tableau tout vert, il faudrait retirer le coach
-- remplacé de course_coaches sur les cours qu'il n'a pas donnés — le cours
-- appartiendrait alors à celui qui l'a assuré. C'est défendable, mais cela
-- réécrit le planning passé : à décider, pas à faire en passant.
