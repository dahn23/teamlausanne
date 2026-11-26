-- =====================================================================
-- 252 — SEMAINE TYPE : copier AUSSI les réservations hors cours
--                                                            26.11.2026
-- =====================================================================
-- db/251 ne copiait que la table `courses`. Or la grille des Réservations
-- affiche `court_bookings`, et une bonne part de ce qu'on y voit n'est
-- rattachée à AUCUN cours : les abonnés de l'hiver, les clubs de la région,
-- les locataires. Sur la semaine du 23.11.2026 : 173 réservations, dont 131
-- liées à un cours et **42 sans cours** — toutes de genre `hiver`, toutes
-- invisibles dans la semaine type. Copier une semaine en laissant 42 lignes
-- derrière, ce n'est pas une copie.
--
-- ⚠ Une semaine type continue de n'écrire AUCUNE ligne dans `court_bookings`
-- (c'est ce qui la rend étanche, cf. db/251). Ces réservations vivent donc
-- dans leur propre table de brouillon, avec un JOUR et pas une date, et ne
-- redeviennent des `court_bookings` qu'au moment où l'on applique.
--
-- ⚠ On ne reprend QUE ce qui décrit le créneau : jour, court, heures, genre,
-- intitulé, couleur. Pas `booked_by`, pas `partner_person_id`, pas le prix,
-- pas `recurrence_id` — un modèle n'appartient à personne, ne facture rien,
-- et sa répétition c'est la plage de dates du bouton « Appliquer ».
-- =====================================================================

create table if not exists plan_template_bookings (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references plan_templates(id) on delete cascade,
  court_id    smallint not null references courts(id),
  dow         smallint not null check (dow between 1 and 7),
  start_time  time not null,
  end_time    time not null,
  kind        text not null default 'libre',
  title       text,
  color       text,
  constraint ptb_duree check (end_time > start_time)
);
create index if not exists plan_template_bookings_tpl on plan_template_bookings(template_id);

alter table plan_template_bookings enable row level security;
drop policy if exists ptb_all on plan_template_bookings;
create policy ptb_all on plan_template_bookings for all
  using (peut_semaine_type(auth.uid())) with check (peut_semaine_type(auth.uid()));

-- ---------------------------------------------------------------------
-- 1) La copie prend maintenant les deux
-- ---------------------------------------------------------------------
create or replace function plan_semaine_depuis(p_nom text, p_lundi date)
returns uuid language plpgsql as $$
declare v_id uuid; v_tc uuid; r record;
        v_lun date := p_lundi - (extract(isodow from p_lundi)::int - 1);
begin
  insert into plan_templates (name, source_week, created_by)
  values (coalesce(nullif(btrim(p_nom), ''), 'Semaine type'), v_lun, auth.uid())
  returning id into v_id;

  -- Les COURS, un par un en gardant leur identifiant d'origine : deux groupes
  -- parallèles partagent souvent jour, heure et intitulé, et les rattacher
  -- après coup par ce triplet les fusionnerait en un seul.
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

  -- Les RÉSERVATIONS QUI NE SONT PAS DES COURS : abonnés d'hiver, clubs,
  -- locataires. C'est la moitié de certaines colonnes de la grille.
  insert into plan_template_bookings (template_id, court_id, dow, start_time, end_time, kind, title, color)
  select v_id, b.court_id, extract(isodow from b.booking_date)::smallint,
         b.start_time, b.end_time, b.kind, b.title, b.color
  from court_bookings b
  where b.booking_date between v_lun and v_lun + 6 and b.course_id is null;

  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 2) L'aperçu les compte et les met dans les conflits
-- ---------------------------------------------------------------------
create or replace function plan_semaine_apercu(p_template uuid, p_du date, p_au date)
returns jsonb language plpgsql stable as $$
declare
  v_lun date; v_d date; r record;
  v_crees int := 0; v_resas int := 0; v_semaines int := 0;
  v_conflits jsonb := '[]'::jsonb;
  v_existants int := 0; v_proteges int := 0; v_resas_place int := 0;
begin
  if p_au < p_du then return jsonb_build_object('erreur', 'La date de fin précède la date de début.'); end if;
  v_lun := p_du - (extract(isodow from p_du)::int - 1);

  while v_lun <= p_au loop
    v_semaines := v_semaines + 1;
    for r in
      select t.id, t.title, t.dow, t.start_time, t.end_time,
             (select array_agg(court_id) from plan_template_courts x where x.template_course_id = t.id) as courts
      from plan_template_courses t where t.template_id = p_template order by t.dow, t.start_time
    loop
      v_d := v_lun + (r.dow - 1);
      continue when v_d < p_du or v_d > p_au;
      if exists (select 1 from court_bookings b
                 where b.court_id = any (coalesce(r.courts, '{}'::smallint[]))
                   and b.booking_date = v_d and b.start_time < r.end_time and b.end_time > r.start_time) then
        v_conflits := v_conflits || jsonb_build_object('date', v_d, 'titre', coalesce(r.title, 'Cours'),
                                                      'heure', to_char(r.start_time, 'HH24:MI'));
      else v_crees := v_crees + 1; end if;
    end loop;
    for r in select * from plan_template_bookings where template_id = p_template order by dow, start_time loop
      v_d := v_lun + (r.dow - 1);
      continue when v_d < p_du or v_d > p_au;
      if exists (select 1 from court_bookings b
                 where b.court_id = r.court_id and b.booking_date = v_d
                   and b.start_time < r.end_time and b.end_time > r.start_time) then
        v_conflits := v_conflits || jsonb_build_object('date', v_d, 'titre', coalesce(r.title, 'Réservation'),
                                                      'heure', to_char(r.start_time, 'HH24:MI'));
      else v_resas := v_resas + 1; end if;
    end loop;
    v_lun := v_lun + 7;
  end loop;

  select count(*) into strict v_existants from courses c where c.course_date between p_du and p_au;
  select count(*) into strict v_proteges from courses c
    where c.course_date between p_du and p_au
      and (exists (select 1 from attendance a where a.course_id = c.id)
        or exists (select 1 from course_segments s where s.course_id = c.id));
  select count(*) into strict v_resas_place from court_bookings b
    where b.booking_date between p_du and p_au and b.course_id is null;

  return jsonb_build_object(
    'semaines', v_semaines, 'crees', v_crees, 'resas', v_resas,
    'conflits', v_conflits, 'nb_conflits', jsonb_array_length(v_conflits),
    'existants', v_existants, 'proteges', v_proteges, 'resas_en_place', v_resas_place);
end $$;

-- ---------------------------------------------------------------------
-- 3) Appliquer : les cours ET les réservations
-- ---------------------------------------------------------------------
-- ⚠ « Remplacer » vide la plage : les cours (sauf ceux dont l'appel est
-- commencé — supprimer un cours cascade sur `attendance` et les heures
-- partent en paie) ET les réservations hors cours, puisque le but est que la
-- semaine ressemble à la semaine type. Le décompte des deux est rendu avant
-- d'écrire, et la console le fait confirmer.
create or replace function plan_semaine_appliquer(p_template uuid, p_du date, p_au date, p_mode text default 'ajouter')
returns jsonb language plpgsql as $$
declare
  v_lun date; v_d date; r record; v_cid uuid; v_court smallint;
  v_crees int := 0; v_resas int := 0; v_supprimes int := 0; v_resas_sup int := 0; v_semaines int := 0;
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
    for r in select c.id, c.course_date, coalesce(c.title, 'Cours') as title, c.start_time
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
    with sup as (
      delete from court_bookings b
      where b.booking_date between p_du and p_au and b.course_id is null returning 1)
    select count(*) into v_resas_sup from sup;
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
        v_ignores := v_ignores || jsonb_build_object('date', v_d, 'titre', coalesce(r.title, 'Cours'),
                                                    'heure', to_char(r.start_time, 'HH24:MI'));
      end;
    end loop;
    -- Les réservations hors cours, une par une : chacune a son propre point de
    -- sauvegarde, pour qu'un court déjà pris n'emporte pas le reste du jour.
    for r in select * from plan_template_bookings where template_id = p_template order by dow, start_time loop
      v_d := v_lun + (r.dow - 1);
      continue when v_d < p_du or v_d > p_au;
      begin
        insert into court_bookings (court_id, booking_date, start_time, end_time, kind, title, color, created_by)
        values (r.court_id, v_d, r.start_time, r.end_time, r.kind, r.title, r.color, auth.uid());
        v_resas := v_resas + 1;
      exception when exclusion_violation or unique_violation then
        v_ignores := v_ignores || jsonb_build_object('date', v_d, 'titre', coalesce(r.title, 'Réservation'),
                                                    'heure', to_char(r.start_time, 'HH24:MI'));
      end;
    end loop;
    v_lun := v_lun + 7;
  end loop;

  update plan_templates
     set applied_at = now(),
         applied_to = to_char(p_du, 'DD.MM.YYYY') || ' → ' || to_char(p_au, 'DD.MM.YYYY')
   where id = p_template;

  return jsonb_build_object('semaines', v_semaines, 'crees', v_crees, 'resas', v_resas,
                            'supprimes', v_supprimes, 'resas_supprimees', v_resas_sup,
                            'ignores', v_ignores, 'nb_ignores', jsonb_array_length(v_ignores),
                            'gardes', v_gardes, 'nb_gardes', jsonb_array_length(v_gardes));
end $$;

-- ---------------------------------------------------------------------
-- 4) Rattraper les semaines types déjà créées sans leurs réservations
-- ---------------------------------------------------------------------
insert into plan_template_bookings (template_id, court_id, dow, start_time, end_time, kind, title, color)
select t.id, b.court_id, extract(isodow from b.booking_date)::smallint,
       b.start_time, b.end_time, b.kind, b.title, b.color
from plan_templates t
join court_bookings b on b.booking_date between t.source_week and t.source_week + 6
where t.source_week is not null and b.course_id is null
  and not exists (select 1 from plan_template_bookings x where x.template_id = t.id);
