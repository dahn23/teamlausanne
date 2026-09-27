-- Mon espace › Cours : le jeune (ou son parent) s'annonce EN RETARD ou ABSENT, avec un message facultatif.
-- 27.09.2026, décision Dan : plus de bouton « Présent » (le jeune est présent par défaut), et on peut revenir
-- à l'état neutre en recliquant.
-- L'annonce va dans course_notices, la table que la console affiche déjà (pastille A / R + message sur le
-- joueur, exclue de l'alerte d'absences du tableau de bord). Avant, le portail écrivait dans
-- course_self_report, que la console ne lisait pas : les coachs ne voyaient rien.

-- D'où vient l'annonce : console (secrétariat, admin, head coach) ou portail (jeune / parent).
alter table public.course_notices add column if not exists via text not null default 'console';
alter table public.course_notices drop constraint if exists course_notices_via;
alter table public.course_notices add constraint course_notices_via check (via in ('console', 'portail'));

-- p_kind = 'retard' | 'absent' pose l'annonce ; p_kind null la retire (retour à l'état neutre).
create or replace function public.portal_set_notice(p_course_id uuid, p_youth_id uuid, p_kind text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_start timestamptz;
begin
  if not public.can_read_public_of(p_youth_id) then raise exception 'Accès refusé pour ce jeune'; end if;
  if not exists (select 1 from course_participants where course_id = p_course_id and child_person_id = p_youth_id) then
    raise exception 'Ce jeune ne participe pas à ce cours';
  end if;
  select (c.course_date + c.start_time) at time zone 'Europe/Zurich' into v_start from courses c where c.id = p_course_id;
  if v_start is null then raise exception 'Cours introuvable'; end if;
  if now() >= v_start then raise exception 'Le cours a déjà commencé'; end if;
  if p_kind is null then
    delete from course_notices where course_id = p_course_id and person_id = p_youth_id;
    return;
  end if;
  if p_kind not in ('retard', 'absent') then raise exception 'Annonce inconnue'; end if;
  insert into course_notices(course_id, person_id, kind, note, created_by, created_at, via)
  values (p_course_id, p_youth_id, p_kind, nullif(left(btrim(coalesce(p_note, '')), 500), ''), auth.uid(), now(), 'portail')
  on conflict (course_id, person_id) do update
    set kind = excluded.kind, note = excluded.note, created_by = excluded.created_by, created_at = now(), via = 'portail';
end $$;
revoke all on function public.portal_set_notice(uuid, uuid, text, text) from public, anon;
grant execute on function public.portal_set_notice(uuid, uuid, text, text) to authenticated;

-- Cours de la semaine pour Mon espace : on renvoie l'annonce en cours (notice_kind / notice_note) à la place de
-- l'ancienne auto-déclaration. Toujours pas les autres joueurs : heure, titre, court(s), coach(s).
create or replace function public.portal_week_courses(p_from date, p_to date)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.course_date, t.start_time, t.youth_first), '[]'::jsonb)
  from (
    select
      c.id                                   as course_id,
      cp.child_person_id                     as youth_id,
      pe.first_name                          as youth_first,
      pe.last_name                           as youth_last,
      c.course_date,
      to_char(c.start_time,'HH24:MI')        as start_time,
      to_char(c.end_time,'HH24:MI')          as end_time,
      coalesce(nullif(c.title,''), ct.name)  as title,
      coalesce(c.color, ct.color)            as color,
      (select string_agg(co.name, ', ' order by co.name)
         from court_bookings cb join courts co on co.id = cb.court_id
        where cb.course_id = c.id)           as court,
      (select string_agg(cpe.first_name, ', ' order by cpe.first_name)
         from course_coaches cc join people cpe on cpe.id = cc.coach_person_id
        where cc.course_id = c.id)           as coach,
      (select a.status::text from attendance a
        where a.course_id = c.id and a.person_id = cp.child_person_id and a.is_coach = false
        limit 1)                             as coach_status,
      n.kind                                 as notice_kind,
      n.note                                 as notice_note
    from courses c
    join course_participants cp on cp.course_id = c.id
    join people pe on pe.id = cp.child_person_id
    left join course_types ct on ct.id = c.course_type_id
    left join course_notices n on n.course_id = c.id and n.person_id = cp.child_person_id
    where c.course_date between p_from and p_to
      and public.can_read_public_of(cp.child_person_id)
  ) t;
$$;
