-- Alerte d'absences (tableau de bord), règle du 23.09.2026 :
--   * uniquement les filières encadrées : pro, pro-u18, sport-etudes, performance, competition ;
--   * fenêtre glissante des 20 DERNIERS JOURS (plus la saison entière) ;
--   * seuil 5 h (réglage absences_seuil_heures), fenêtre 20 j (réglage absences_fenetre_jours).
-- On compte toujours des heures de cours marqués « absent », pas des séances.

update app_settings set value = '5'::jsonb where key = 'absences_seuil_heures';
insert into app_settings (key, value) values ('absences_fenetre_jours', '20'::jsonb)
on conflict (key) do nothing;

create or replace function public.absences_a_signaler()
returns table (person_id uuid, eleve text, filiere text,
               heures numeric, seances int, derniere date, parent text)
language sql stable security definer set search_path = public as $$
  with saison as (
    select id from seasons
     where kind = 'juniors' and current_date between start_date and end_date
  ),
  regle as (
    select coalesce((select value::text::numeric from app_settings where key = 'absences_seuil_heures'), 5) as h,
           coalesce((select value::text::int from app_settings where key = 'absences_fenetre_jours'), 20) as j
  ),
  suivis as (
    select distinct rp.person_id
      from role_periods rp
     where rp.season_id = (select id from saison)
       and rp.role in ('pro', 'pro-u18', 'sport-etudes', 'performance', 'competition')
  ),
  abs as (
    select a.person_id,
           round(sum(extract(epoch from (c.end_time - c.start_time)) / 3600.0)::numeric, 2) as heures,
           count(*)::int as seances,
           max(c.course_date) as derniere
      from attendance a
      join courses c on c.id = a.course_id
     where not a.is_coach and a.status = 'absent'
       and a.person_id in (select person_id from suivis)
       and c.course_date > current_date - (select j from regle)
       and c.course_date <= current_date
     group by a.person_id
  )
  select pe.id, pe.first_name || ' ' || pe.last_name,
         (select string_agg(rp.role, ', ' order by rp.role) from role_periods rp
           where rp.person_id = pe.id and rp.season_id = (select id from saison)),
         abs.heures, abs.seances, abs.derniere,
         nullif(btrim(coalesce(pe.parent1, '')), '')
    from abs join people pe on pe.id = abs.person_id
   where is_staff(auth.uid())
     and coalesce(pe.is_active, true)
     and abs.heures > (select h from regle)
   order by abs.heures desc, pe.last_name;
$$;
