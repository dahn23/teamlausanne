-- =====================================================================
-- 251 — SEMAINE TYPE (brouillon de planning)                26.11.2026
-- =====================================================================
-- Un bac à sable pour le planning des cours : on copie une semaine réelle
-- dans une « semaine type », on la retouche autant qu'on veut, puis on la
-- pousse sur une ou plusieurs semaines à venir.
--
-- ⚠⚠ CE QUI REND LE BAC À SABLE ÉTANCHE : une semaine type n'écrit AUCUNE
-- ligne dans `court_bookings`. C'est `court_bookings` qui occupe un court,
-- qui déclenche l'anti-chevauchement (db/04) et qui s'affiche dans la grille
-- de réservation publique. Les courts d'un cours type sont donc mémorisés à
-- part (`plan_template_courts`), comme une simple liste, et les réservations
-- ne naissent qu'au moment où l'on pousse. Tant qu'on bricole, rien n'est
-- réservé, rien n'est visible côté joueurs, rien n'entre dans la paie.
--
-- ⚠ Un cours type porte un JOUR DE LA SEMAINE (`dow`, 1 = lundi), pas une
-- date. Une date l'attacherait à une semaine précise, et il faudrait la
-- décaler à chaque réemploi — c'est exactement la corvée qu'on supprime.
--
-- Les tables reprennent la forme de `courses` + `course_coaches` +
-- `course_participants`, à trois choses près, toutes volontaires :
--   · pas de `statut` sur les coachs — « non disponible » vaut pour UNE
--     séance (db/240), pas pour un modèle ;
--   · pas d'`attendance`, pas de `course_segments` — on ne fait pas l'appel
--     d'un cours qui n'a pas eu lieu ;
--   · pas de `recurrence_id` — la répétition, ici, c'est la plage de dates
--     du bouton « Appliquer ».
-- =====================================================================

create table if not exists plan_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  note        text,
  source_week date,                      -- lundi de la semaine copiée (trace)
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  applied_at  timestamptz,               -- dernier emploi
  applied_to  text                       -- « du 05.01 au 30.06 », en clair
);

create table if not exists plan_template_courses (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid not null references plan_templates(id) on delete cascade,
  course_type_id uuid references course_types(id),
  title          text,
  dow            smallint not null check (dow between 1 and 7),   -- 1 = lundi … 7 = dimanche
  start_time     time not null,
  end_time       time not null,
  color          text,
  notes          text,
  constraint ptc_duree check (end_time > start_time)
);
create index if not exists plan_template_courses_tpl on plan_template_courses(template_id);

create table if not exists plan_template_courts (
  template_course_id uuid not null references plan_template_courses(id) on delete cascade,
  court_id           smallint not null references courts(id),
  primary key (template_course_id, court_id)
);
create table if not exists plan_template_coaches (
  template_course_id uuid not null references plan_template_courses(id) on delete cascade,
  coach_person_id    uuid not null references people(id) on delete cascade,
  primary key (template_course_id, coach_person_id)
);
create table if not exists plan_template_players (
  template_course_id uuid not null references plan_template_courses(id) on delete cascade,
  child_person_id    uuid not null references people(id) on delete cascade,
  primary key (template_course_id, child_person_id)
);

-- ---------------------------------------------------------------------
-- RLS — exactement la porte du planning : `courses_write` / `cp_write`.
-- Qui peut écrire un cours peut écrire un brouillon de cours, ni plus ni
-- moins. En lecture non plus on n'ouvre pas : une semaine type est un
-- brouillon, pas une information de service — un coach qui la verrait dans
-- l'app la prendrait pour son horaire.
-- ---------------------------------------------------------------------
alter table plan_templates        enable row level security;
alter table plan_template_courses enable row level security;
alter table plan_template_courts  enable row level security;
alter table plan_template_coaches enable row level security;
alter table plan_template_players enable row level security;

create or replace function peut_semaine_type(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_head(uid) or has_role(uid, 'secretaire');
$$;

drop policy if exists pt_all on plan_templates;
create policy pt_all on plan_templates for all
  using (peut_semaine_type(auth.uid())) with check (peut_semaine_type(auth.uid()));

drop policy if exists ptc_all on plan_template_courses;
create policy ptc_all on plan_template_courses for all
  using (peut_semaine_type(auth.uid())) with check (peut_semaine_type(auth.uid()));

drop policy if exists ptct_all on plan_template_courts;
create policy ptct_all on plan_template_courts for all
  using (peut_semaine_type(auth.uid())) with check (peut_semaine_type(auth.uid()));

drop policy if exists ptco_all on plan_template_coaches;
create policy ptco_all on plan_template_coaches for all
  using (peut_semaine_type(auth.uid())) with check (peut_semaine_type(auth.uid()));

drop policy if exists ptp_all on plan_template_players;
create policy ptp_all on plan_template_players for all
  using (peut_semaine_type(auth.uid())) with check (peut_semaine_type(auth.uid()));

-- =====================================================================
-- 1) Fabriquer une semaine type À PARTIR d'une semaine réelle
-- =====================================================================
-- SECURITY INVOKER (le défaut) : la RLS du demandeur s'applique de bout en
-- bout. Pas de SECURITY DEFINER ici — il faudrait reposer à la main toutes
-- les gardes que la RLS pose déjà, et c'est précisément là qu'on se trompe.
create or replace function plan_semaine_depuis(p_nom text, p_lundi date)
returns uuid language plpgsql as $$
declare v_id uuid; v_tc uuid; r record;
        v_lun date := p_lundi - (extract(isodow from p_lundi)::int - 1);
begin
  insert into plan_templates (name, source_week, created_by)
  values (coalesce(nullif(btrim(p_nom), ''), 'Semaine type'), v_lun, auth.uid())
  returning id into v_id;

  -- ⚠ Un cours à la fois, en gardant SON identifiant d'origine. La tentation
  -- est d'insérer les cours en bloc puis de rattacher courts, coachs et
  -- joueurs par (jour, heure, titre) — mais deux groupes parallèles portent
  -- souvent les mêmes trois valeurs et ne diffèrent que par le court : ils
  -- seraient fusionnés en un seul cours portant les joueurs des deux.
  for r in select * from courses c where c.course_date between v_lun and v_lun + 6
           order by c.course_date, c.start_time
  loop
    insert into plan_template_courses (template_id, course_type_id, title, dow, start_time, end_time, color, notes)
    values (v_id, r.course_type_id, r.title, extract(isodow from r.course_date)::smallint,
            r.start_time, r.end_time, r.color, r.notes)
    returning id into v_tc;

    insert into plan_template_courts (template_course_id, court_id)
    select distinct v_tc, b.court_id from court_bookings b where b.course_id = r.id;

    -- ⚠ `statut` n'est PAS repris : une indisponibilité vaut pour une séance
    -- (db/240). La recopier dans un modèle la propagerait à l'infini.
    insert into plan_template_coaches (template_course_id, coach_person_id)
    select distinct v_tc, cc.coach_person_id from course_coaches cc where cc.course_id = r.id;

    insert into plan_template_players (template_course_id, child_person_id)
    select distinct v_tc, cp.child_person_id from course_participants cp where cp.course_id = r.id;
  end loop;

  return v_id;
end $$;

-- =====================================================================
-- 2) Aperçu — ce que « Appliquer » ferait, SANS rien écrire
-- =====================================================================
-- Le bouton ne doit jamais être une surprise : on montre d'abord combien de
-- cours seraient créés, lesquels tomberaient sur un court déjà pris, ce que
-- la semaine contient déjà, et surtout combien de cours existants ont DÉJÀ
-- un appel — ceux-là, « Remplacer » n'y touchera pas (voir plus bas).
create or replace function plan_semaine_apercu(p_template uuid, p_du date, p_au date)
returns jsonb language plpgsql stable as $$
declare
  v_lun date; v_d date; r record;
  v_crees int := 0; v_semaines int := 0;
  v_conflits jsonb := '[]'::jsonb;
  v_existants int := 0; v_proteges int := 0;
begin
  if p_au < p_du then return jsonb_build_object('erreur', 'La date de fin précède la date de début.'); end if;
  v_lun := p_du - (extract(isodow from p_du)::int - 1);

  while v_lun <= p_au loop
    v_semaines := v_semaines + 1;
    for r in
      select t.*, (select array_agg(court_id) from plan_template_courts x where x.template_course_id = t.id) as courts
      from plan_template_courses t where t.template_id = p_template order by t.dow, t.start_time
    loop
      v_d := v_lun + (r.dow - 1);
      continue when v_d < p_du or v_d > p_au;     -- la plage peut commencer un mercredi
      if exists (
        select 1 from court_bookings b
        where b.court_id = any (coalesce(r.courts, '{}'::smallint[]))
          and b.booking_date = v_d
          and b.start_time < r.end_time and b.end_time > r.start_time
      ) then
        v_conflits := v_conflits || jsonb_build_object('date', v_d, 'titre', coalesce(r.title, 'Cours'),
                                                      'heure', to_char(r.start_time, 'HH24:MI'));
      else
        v_crees := v_crees + 1;
      end if;
    end loop;
    v_lun := v_lun + 7;
  end loop;

  select count(*) into strict v_existants from courses c where c.course_date between p_du and p_au;
  select count(*) into strict v_proteges from courses c
    where c.course_date between p_du and p_au
      and (exists (select 1 from attendance a where a.course_id = c.id)
        or exists (select 1 from course_segments s where s.course_id = c.id));

  return jsonb_build_object(
    'semaines', v_semaines, 'crees', v_crees,
    'conflits', v_conflits, 'nb_conflits', jsonb_array_length(v_conflits),
    'existants', v_existants, 'proteges', v_proteges);
end $$;

-- =====================================================================
-- 3) Appliquer
-- =====================================================================
-- p_mode = 'ajouter'   : on pose les cours à côté de ce qui existe ; tout ce
--                        qui tomberait sur un court déjà pris est sauté et
--                        rendu nommément. Rien n'est écrasé.
-- p_mode = 'remplacer' : on vide d'abord la plage, puis on pose.
--
-- ⚠⚠ « Remplacer » NE SUPPRIME JAMAIS un cours dont l'appel est commencé.
-- Supprimer un cours cascade sur `attendance` ET `course_segments` : les
-- heures du coach disparaîtraient avec, et ces heures-là partent en paie
-- (db/240, db/242). Un planning qu'on réorganise ne doit pas pouvoir effacer
-- un salaire. Les cours gardés sont rendus dans le rapport, nommément, pour
-- qu'on sache quoi faire d'eux à la main.
create or replace function plan_semaine_appliquer(p_template uuid, p_du date, p_au date, p_mode text default 'ajouter')
returns jsonb language plpgsql as $$
declare
  v_lun date; v_d date; r record; v_cid uuid; v_court smallint;
  v_crees int := 0; v_supprimes int := 0; v_semaines int := 0;
  v_ignores jsonb := '[]'::jsonb; v_gardes jsonb := '[]'::jsonb;
  v_nom text;
begin
  if not peut_semaine_type(auth.uid()) then
    raise exception 'Réservé à la direction et au secrétariat.';
  end if;
  if p_au < p_du then raise exception 'La date de fin précède la date de début.'; end if;
  if p_mode not in ('ajouter', 'remplacer') then raise exception 'Mode inconnu : %', p_mode; end if;
  select name into v_nom from plan_templates where id = p_template;
  if v_nom is null then raise exception 'Semaine type introuvable.'; end if;

  if p_mode = 'remplacer' then
    for r in
      select c.id, c.course_date, coalesce(c.title, 'Cours') as title, c.start_time
      from courses c where c.course_date between p_du and p_au
    loop
      if exists (select 1 from attendance a where a.course_id = r.id)
         or exists (select 1 from course_segments s where s.course_id = r.id) then
        v_gardes := v_gardes || jsonb_build_object('date', r.course_date, 'titre', r.title,
                                                  'heure', to_char(r.start_time, 'HH24:MI'));
      else
        delete from courses where id = r.id;   -- cascade : courts, coachs, joueurs
        v_supprimes := v_supprimes + 1;
      end if;
    end loop;
  end if;

  v_lun := p_du - (extract(isodow from p_du)::int - 1);
  while v_lun <= p_au loop
    v_semaines := v_semaines + 1;
    for r in
      select t.*, (select array_agg(court_id) from plan_template_courts x where x.template_course_id = t.id) as courts
      from plan_template_courses t where t.template_id = p_template order by t.dow, t.start_time
    loop
      v_d := v_lun + (r.dow - 1);
      continue when v_d < p_du or v_d > p_au;
      begin
        insert into courses (course_type_id, title, course_date, start_time, end_time, color, notes, created_by)
        values (r.course_type_id, r.title, v_d, r.start_time, r.end_time, r.color, r.notes, auth.uid())
        returning id into v_cid;

        -- Les réservations de court arrivent ICI et nulle part avant : c'est
        -- le moment où le brouillon devient réalité. L'anti-chevauchement
        -- (db/04) est la dernière garde ; s'il tire, tout ce cours est annulé
        -- par le bloc EXCEPTION et le reste de la semaine continue.
        foreach v_court in array coalesce(r.courts, '{}'::smallint[]) loop
          insert into court_bookings (court_id, booking_date, start_time, end_time, kind, title, color, created_by, course_id)
          values (v_court, v_d, r.start_time, r.end_time, 'cours', coalesce(r.title, 'Cours'), r.color, auth.uid(), v_cid);
        end loop;

        insert into course_coaches (course_id, coach_person_id)
        select v_cid, coach_person_id from plan_template_coaches where template_course_id = r.id;

        insert into course_participants (course_id, child_person_id)
        select v_cid, child_person_id from plan_template_players where template_course_id = r.id;

        v_crees := v_crees + 1;
      exception when exclusion_violation or unique_violation then
        -- Le court est déjà pris à cette heure-là : on saute CE cours, on le
        -- dit, et on continue. Le bloc BEGIN/EXCEPTION est un point de
        -- sauvegarde : le cours à moitié créé est défait, pas le reste.
        v_ignores := v_ignores || jsonb_build_object('date', v_d, 'titre', coalesce(r.title, 'Cours'),
                                                    'heure', to_char(r.start_time, 'HH24:MI'));
      end;
    end loop;
    v_lun := v_lun + 7;
  end loop;

  update plan_templates
     set applied_at = now(),
         applied_to = to_char(p_du, 'DD.MM.YYYY') || ' → ' || to_char(p_au, 'DD.MM.YYYY')
   where id = p_template;

  return jsonb_build_object('semaines', v_semaines, 'crees', v_crees, 'supprimes', v_supprimes,
                            'ignores', v_ignores, 'nb_ignores', jsonb_array_length(v_ignores),
                            'gardes', v_gardes, 'nb_gardes', jsonb_array_length(v_gardes));
end $$;

grant execute on function plan_semaine_depuis(text, date)              to authenticated;
grant execute on function plan_semaine_apercu(uuid, date, date)        to authenticated;
grant execute on function plan_semaine_appliquer(uuid, date, date, text) to authenticated;
