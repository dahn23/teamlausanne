-- 192 — Un cours « détaillé » sans aucun segment ne vaut plus zéro heure.
--
-- Signalé le 20.10.2026 : dans l'onglet Réserv., Mark Gattiker apparaît la
-- semaine prochaine avec « 0 h · 8 cours ». Il n'est pas seul — Mariano Palena
-- et Yann Perez perdent aussi des heures sur les mêmes leçons.
--
-- CE QUI SE PASSAIT.
--
-- Un cours pro ou sport-études posé sur plusieurs courts, ou mené par
-- plusieurs coachs, est « détaillé » (course_is_detailed) : ses heures ne se
-- lisent pas sur sa durée mais sur ses SEGMENTS, ces tranches qui disent quel
-- coach était sur quel court et combien de temps. C'est ce qui permet de
-- compter juste quand un coach passe d'un court à l'autre.
--
-- Mais les quatorze leçons du 26 au 30 octobre n'ont AUCUN segment : elles
-- viennent d'être posées et personne ne les a encore détaillées. La règle
-- lisait donc « heures = somme des segments » = 0, pour tout le monde. Pire
-- qu'une erreur d'affichage : staff_hours_month_brut, my_hours_month,
-- person_pay_season et prive_adultes_month suivent la même règle, donc ces
-- leçons d'octobre allaient être PAYÉES zéro.
--
-- Le cas le plus net : le mardi 27 à 08h15, deux heures de sport-études avec
-- Gattiker SEUL. Deux courts, donc « détaillé », donc zéro heure — alors qu'un
-- seul coach sur deux heures ne pose aucune question de répartition.
--
-- LE CORRECTIF, et pourquoi il est à cet endroit.
--
-- Les segments RAFFINENT un décompte ; leur absence ne doit pas l'effacer.
-- Quand un cours n'a aucun segment, on retombe donc sur sa durée, exactement
-- comme un cours ordinaire. Un cours qui a des segments ne bouge pas : un
-- coach sans segment y vaut toujours zéro, et c'est voulu — il n'y a pas pris
-- part.
--
-- Le correctif est dans coach_segment_minutes et NON dans course_is_detailed,
-- qui aurait été plus court. Car ce drapeau sert aussi à mark_attendance : sur
-- un cours détaillé, les présences des jeunes reviennent au head coach, et un
-- coach peut se déclarer présent sans avoir pointé tout le monde. Le toucher
-- aurait changé les règles de pointage en passant, pour un bug d'heures.
--
-- La valeur de repli est la bonne, et pas un pis-aller : sur les cours déjà
-- segmentés, la somme d'un coach dépasse souvent la durée (il couvre deux
-- courts en parallèle), et le least() la ramène précisément à cette durée.
-- Un coach présent vaut donc déjà la durée du cours ; le repli rend la même
-- chose.

begin;

create or replace function public.coach_segment_minutes(p_course uuid, p_coach uuid)
returns numeric language sql stable security definer set search_path to 'public' as $$
  select case
    -- Le cours a été détaillé : on lit ses segments, comme avant. Un coach qui
    -- n'y figure pas vaut zéro, et c'est exact.
    when exists (select 1 from course_segments s where s.course_id = p_course) then
      least(
        coalesce((select sum(s.minutes) from course_segments s
                   where s.course_id = p_course and s.coach_person_id = p_coach), 0),
        coalesce((select extract(epoch from (c.end_time - c.start_time)) / 60.0
                    from courses c where c.id = p_course), 0))
    -- Aucun segment : rien à répartir, le cours vaut sa durée.
    else
      coalesce((select extract(epoch from (c.end_time - c.start_time)) / 60.0
                  from courses c where c.id = p_course), 0)
  end;
$$;

comment on function public.coach_segment_minutes(uuid, uuid) is
  'Minutes d''un coach sur un cours : ses segments s''il y en a, sinon la durée du cours (db/192).';

commit;
