-- ===================================================================
--  COURS › types « location de court » (16.10.2026)
-- ===================================================================
-- Demande : voir le planning d'HIVER par-dessus celui de l'école de tennis, et
-- lire d'un coup d'œil où tombe chaque occupation de court. Les clubs et les
-- membres qui louent doivent donc pouvoir se poser sur la grille comme un
-- cours : même grille, même quart d'heure, même blocage du court.
--
-- ⚠️ MAIS CE NE SONT PAS DES HEURES DE COACH. Un club qui loue un court ne
-- donne pas de leçon, et personne ne doit être payé pour sa présence. Or
-- course_counts_standard() était écrit « tout sauf privé-adultes » : un type de
-- cours ajouté naïvement serait donc tombé dans les heures du mois, les fiches
-- de salaire, la paie par saison ET l'export fiduciaire, dès qu'un coach aurait
-- été accroché au bloc. D'où un TROISIÈME panier, qui ne compte nulle part.
--
-- La bascule est faite dans le bon sens : « standard » devient une liste
-- blanche (= 'standard') au lieu d'une liste noire (<> 'prive_adultes'). Le
-- prochain panier qu'on ajoutera sera donc exclu par défaut des salaires, ce
-- qui est le seul défaut acceptable quand il s'agit d'argent.

alter table public.course_types drop constraint if exists course_types_hours_bucket_check;
alter table public.course_types add constraint course_types_hours_bucket_check
  check (hours_bucket in ('standard', 'prive_adultes', 'location'));

-- Liste blanche : seul 'standard' compte dans les décomptes et les salaires.
create or replace function public.course_counts_standard(p_course uuid)
returns boolean language sql stable as $$
  select coalesce((select ct.hours_bucket = 'standard'
                     from courses c left join course_types ct on ct.id = c.course_type_id
                    where c.id = p_course), true);
$$;

-- Le panier d'un cours, pour pouvoir viser un panier PRÉCIS au lieu de
-- raisonner par « tout ce qui n'est pas standard » — c'est exactement ce
-- raisonnement qui aurait fait entrer les locations dans Privé-adultes.
create or replace function public.course_hours_bucket(p_course uuid)
returns text language sql stable as $$
  select coalesce((select ct.hours_bucket
                     from courses c left join course_types ct on ct.id = c.course_type_id
                    where c.id = p_course), 'standard');
$$;
revoke all on function public.course_hours_bucket(uuid) from public, anon;
grant execute on function public.course_hours_bucket(uuid) to authenticated;

-- ---------- « Mes heures » du coach : privé-adultes visé nommément ----------
create or replace function public.my_hours_month(p_ym text)
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (select person_id as pid from profiles where user_id = auth.uid()),
  pd as (
    select d.id as day_id, ev.status as vstatus, ev.hours as vhours, etudes_day_complete(d.id) as complete
    from etudes_day_profs dp join etudes_days d on d.id = dp.day_id join me on dp.prof_person_id = me.pid
    left join etudes_day_validation ev on ev.day_id = d.id and ev.prof_person_id = me.pid
    where to_char(d.day,'YYYY-MM') = p_ym
  ),
  cs as (
    select c.id, course_counts_standard(c.id) as std,
      course_hours_bucket(c.id) = 'prive_adultes' as pa,
      case when course_is_detailed(c.id) then coach_segment_minutes(c.id, me.pid) / 60.0
           when exists (select 1 from attendance a where a.course_id = c.id and a.person_id = me.pid and a.is_coach and a.status = 'present') or v.course_id is not null
             then extract(epoch from (c.end_time - c.start_time)) / 3600.0
           else 0 end as hours,
      case when course_is_detailed(c.id) then exists (select 1 from course_segments s where s.course_id = c.id)
           else (exists (select 1 from attendance a where a.course_id = c.id and a.person_id = me.pid and a.is_coach and a.status = 'present') or v.course_id is not null) end as validated
    from courses c join course_coaches cc on cc.course_id = c.id join me on cc.coach_person_id = me.pid
    left join course_validation v on v.course_id = c.id and v.coach_person_id = me.pid
    where to_char(c.course_date, 'YYYY-MM') = p_ym
  )
  select jsonb_build_object(
    'person_id', (select pid from me),
    'coach_hours', coalesce((select round(sum(hours)::numeric, 2) from cs where std), 0),
    'coach_val', coalesce((select count(*) filter (where validated) from cs where std), 0),
    'coach_total', coalesce((select count(*) from cs where std), 0),
    'pa_hours', coalesce((select round(sum(hours)::numeric, 2) from cs where pa), 0),
    'pa_val', coalesce((select count(*) filter (where validated) from cs where pa), 0),
    'pa_total', coalesce((select count(*) from cs where pa), 0),
    'prof_hours', coalesce((select sum(case when vstatus='present' then coalesce(vhours,4) when complete then 4 else 0 end) from pd), 0),
    'prof_val', coalesce((select count(*) filter (where vstatus='present' or complete) from pd), 0),
    'prof_total', coalesce((select count(*) from pd), 0)
  );
$$;

-- ---------- Heures › Privé-adultes : le panier, pas « non-standard » ----------
create or replace function public.prive_adultes_month(p_ym text)
returns jsonb language sql stable security definer set search_path = public as $$
  with h as (
    select cc.coach_person_id as pid,
      round(sum(case
          when course_is_detailed(c.id) then coach_segment_minutes(c.id, cc.coach_person_id) / 60.0
          when exists (select 1 from attendance a where a.course_id = c.id and a.person_id = cc.coach_person_id and a.is_coach and a.status = 'present') or v.course_id is not null
            then extract(epoch from (c.end_time - c.start_time)) / 3600.0
          else 0 end)::numeric, 2) as hours,
      round(sum(extract(epoch from (c.end_time - c.start_time)) / 3600.0)::numeric, 2) as planned,
      count(*) filter (where case when course_is_detailed(c.id) then exists (select 1 from course_segments s where s.course_id = c.id)
          else (exists (select 1 from attendance a where a.course_id = c.id and a.person_id = cc.coach_person_id and a.is_coach and a.status = 'present') or v.course_id is not null) end) as n_val,
      count(*) as n_total,
      jsonb_agg(jsonb_build_object('date', c.course_date, 'start', to_char(c.start_time, 'HH24:MI'), 'end', to_char(c.end_time, 'HH24:MI'),
        'title', coalesce(nullif(c.title, ''), 'Privé-adultes'),
        'hours', round((extract(epoch from (c.end_time - c.start_time)) / 3600.0)::numeric, 2),
        'validated', (case when course_is_detailed(c.id) then exists (select 1 from course_segments s where s.course_id = c.id)
          else (exists (select 1 from attendance a where a.course_id = c.id and a.person_id = cc.coach_person_id and a.is_coach and a.status = 'present') or v.course_id is not null) end)) order by c.course_date, c.start_time) as detail
    from courses c join course_coaches cc on cc.course_id = c.id
    left join course_validation v on v.course_id = c.id and v.coach_person_id = cc.coach_person_id
    where to_char(c.course_date, 'YYYY-MM') = p_ym
      and course_hours_bucket(c.id) = 'prive_adultes'
    group by cc.coach_person_id
  )
  select case when can_hours(auth.uid())
    then coalesce((select jsonb_agg(jsonb_build_object('person_id', h.pid, 'name', pe.first_name || ' ' || pe.last_name,
           'hours', h.hours, 'planned', h.planned, 'courses', h.n_val, 'total_courses', h.n_total, 'detail', h.detail) order by pe.last_name)
           from h join people pe on pe.id = h.pid), '[]'::jsonb)
    else '[]'::jsonb end;
$$;
revoke all on function public.prive_adultes_month(text) from public, anon;
grant execute on function public.prive_adultes_month(text) to authenticated;

-- ---------- Les types eux-mêmes ----------
-- Les noms reprennent EXACTEMENT ceux des fiches de Répertoire › Locations de
-- courts (TC Montchoisi, TC Lutry, Green Club, Stade Lausanne, Xavier
-- Schumacher) : deux orthographes pour un même club et plus personne ne sait
-- si « Montchoisi » et « Mon-Choisi » sont le même locataire.
--
-- Teintes sombres et sourdes, à l'écart des couleurs vives des cours : sur la
-- grille d'hiver, on doit voir d'un coup ce qui est une leçon et ce qui est une
-- location, sans lire les étiquettes.
insert into public.course_types (name, color, note, hours_bucket)
select v.name, v.color, v.note, 'location'
  from (values
    ('Privé Schumacher', '#92400e', 'Location de court — Xavier Schumacher. Bloque le court, ne compte dans aucune heure de coach.'),
    ('Membre',           '#57534e', 'Location de court par un membre. Bloque le court, ne compte dans aucune heure de coach.'),
    ('TC Montchoisi',    '#155e75', 'Location de court — TC Montchoisi. Bloque le court, ne compte dans aucune heure de coach.'),
    ('Green Club',       '#3f6212', 'Location de court — Green Club. Bloque le court, ne compte dans aucune heure de coach.'),
    ('Stade Lausanne',   '#9f1239', 'Location de court — Stade Lausanne. Bloque le court, ne compte dans aucune heure de coach.'),
    ('TC Lutry',         '#4c1d95', 'Location de court — TC Lutry. Bloque le court, ne compte dans aucune heure de coach.')
  ) as v(name, color, note)
 where not exists (select 1 from public.course_types ct where ct.name = v.name);
