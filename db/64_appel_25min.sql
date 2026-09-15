-- 64_appel_25min.sql
-- L'appel (présences) ouvre 25 minutes avant le début du cours, au lieu de 10.
-- Mêmes corps que les migrations 09/10 : seule la borne d'ouverture change
-- (mark_attendance et clear_attendance). Le client (admin.js) applique la même fenêtre.

create or replace function public.mark_attendance(p_course uuid, p_person uuid, p_status text, p_is_coach boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_person uuid;
  v_start timestamp;
  v_now timestamp := (now() at time zone 'Europe/Zurich');
  v_detailed boolean := course_is_detailed(p_course);
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if p_is_coach and p_status = 'late' then
    raise exception 'Un coach ne peut pas être marqué « en retard ».';
  end if;
  if not is_head(v_uid) then
    select person_id into v_person from profiles where user_id = v_uid;
    if not exists (select 1 from course_coaches where course_id = p_course and coach_person_id = v_person) then
      raise exception 'Accès refusé : vous n''êtes pas coach de ce cours.';
    end if;
    if v_detailed and not p_is_coach then
      raise exception 'Sur ce cours (pro / sport-études), les présences des jeunes sont gérées par le head coach.';
    end if;
    select (course_date + start_time) into v_start from courses where id = p_course;
    -- Fenêtre d'ouverture : 25 min avant le début. EXCEPTION : un coach peut se declarer ABSENT a l'avance.
    if not (p_is_coach and p_status = 'absent') then
      if v_now < v_start - interval '25 minutes' then
        raise exception 'Le pointage ouvre 25 minutes avant le début du cours.';
      end if;
    end if;
    if v_now > v_start + interval '14 days' then
      raise exception 'Pointage clos (2 semaines écoulées). Demandez à un head coach / admin.';
    end if;
    if p_is_coach then
      if p_person <> v_person then raise exception 'Vous ne pouvez marquer que votre propre présence.'; end if;
      -- Se declarer PRESENT exige que tous les jeunes aient un statut (sauf cours detaille).
      if p_status <> 'absent' and not v_detailed then
        if exists (
          select 1 from course_participants cp
          where cp.course_id = p_course
            and not exists (select 1 from attendance a where a.course_id = p_course and a.person_id = cp.child_person_id)
        ) then
          raise exception 'Marquez d''abord la présence de tous les jeunes avant de vous déclarer présent.';
        end if;
      end if;
    end if;
  end if;
  insert into attendance (course_id, person_id, status, is_coach, marked_by, marked_at)
  values (p_course, p_person, p_status::attendance_status, p_is_coach, v_uid, now())
  on conflict (course_id, person_id) do update
    set status = excluded.status, is_coach = excluded.is_coach, marked_by = v_uid, marked_at = now();
end; $$;

create or replace function public.clear_attendance(p_course uuid, p_person uuid, p_is_coach boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_person uuid;
  v_start timestamp;
  v_now timestamp := (now() at time zone 'Europe/Zurich');
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if not is_head(v_uid) then
    select person_id into v_person from profiles where user_id = v_uid;
    if not exists (select 1 from course_coaches where course_id = p_course and coach_person_id = v_person) then
      raise exception 'Accès refusé : vous n''êtes pas coach de ce cours.';
    end if;
    if p_is_coach and p_person <> v_person then
      raise exception 'Vous ne pouvez modifier que votre propre présence.';
    end if;
    select (course_date + start_time) into v_start from courses where id = p_course;
    -- Borne d'ouverture : seulement pour les JEUNES (le coach peut annuler sa propre absence anticipee).
    if not p_is_coach then
      if v_now < v_start - interval '25 minutes' then
        raise exception 'Le pointage ouvre 25 minutes avant le début du cours.';
      end if;
    end if;
    if v_now > v_start + interval '14 days' then
      raise exception 'Pointage clos (2 semaines écoulées).';
    end if;
  end if;
  delete from attendance where course_id = p_course and person_id = p_person;
end; $$;
