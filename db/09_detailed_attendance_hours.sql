-- 09_detailed_attendance_hours.sql
-- Cours "detaille" = pro/sport-etudes AVEC plusieurs coachs OU plusieurs joueurs.
-- Pour ces cours : le head coach gere les presences des jeunes ET les heures via
-- le detail (blocs). Un coach normal ne marque QUE sa propre presence (present/absent),
-- sans etre bloque par "tous les jeunes d'abord", et ne peut PAS marquer les jeunes.
-- Les heures d'un coach sur un cours detaille = ses minutes de blocs (pas la duree pleine).
-- Applique via migration detailed_course_attendance_and_hours.

create or replace function public.course_is_detailed(p_course uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from courses c join course_types ct on ct.id = c.course_type_id
    where c.id = p_course
      and ct.name ~* '(pro|tud)'
      and ( (select count(*) from course_coaches cc where cc.course_id = c.id) > 1
         or (select count(*) from course_participants cp where cp.course_id = c.id) > 1 )
  );
$$;

-- mark_attendance : voir migration (bloque le coach normal sur les jeunes des cours
-- detailles ; leve la contrainte "tous les jeunes d'abord" pour sa propre presence).
-- staff_hours_month / my_hours_month : heures depuis course_segments pour les cours detailles.
-- (Corps complets dans la migration Supabase du meme nom.)
