-- ===================================================================
--  COURS › deux types de location génériques (16.10.2026)
-- ===================================================================
-- « Membre » devient « Membre-hiver », et « Non-membre hiver » le rejoint.
-- Les deux nouveaux noms disent la saison, ce qui évite de se demander en
-- juin pourquoi un bloc « Membre » traîne sur la grille d'été.
--
-- Surtout, ils reprennent la seule distinction qui compte pour le prix : le
-- planning d'hiver range chaque case en « membre » ou « normal » (non-membre),
-- et les deux tarifs qui en découlent sont 925/800 contre 1100/950. La grille
-- des cours parle désormais la même langue que la facturation.

update course_types
   set name = 'Membre-hiver',
       note = 'Location de court par un membre, saison d''hiver. Bloque le court, ne compte dans aucune heure de coach.'
 where name = 'Membre' and hours_bucket = 'location';

insert into course_types (name, color, note, hours_bucket)
select 'Non-membre hiver', '#475569',
       'Location de court par un non-membre (club, externe), saison d''hiver. Bloque le court, ne compte dans aucune heure de coach.',
       'location'
 where not exists (select 1 from course_types where name = 'Non-membre hiver');

-- ---- Le repli du générateur suit le STATUT du locataire ------------
-- winter_rentals_generate() retombait sur le type nommé « Membre » quand un
-- locataire n'avait pas son type à lui. Ce repli se serait cassé en silence
-- avec le renommage — la fonction aurait levé « Aucun type de cours
-- location », et personne n'aurait fait le lien avec un libellé changé.
--
-- Tant qu'à le corriger, autant le rendre juste : un club ou un externe n'est
-- pas un membre, et le bloc doit porter la bonne couleur sur la grille. Le
-- repli lit donc court_tenants.kind.
create or replace function public.winter_rentals_generate(
  p_season text,
  p_from   date    default date '2026-10-26',
  p_to     date    default date '2027-04-14',
  p_apply  boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cree int := 0; v_deja int := 0; v_ferme int := 0;
  v_conflits jsonb := '[]'::jsonb;
  v_prevu   jsonb := '[]'::jsonb;
  r record; d date; v_court int; v_courts int[]; v_rec uuid; v_type uuid; v_couleur text;
  v_course uuid; v_clash text; v_titre text; v_defaut text;
begin
  if not (is_head(auth.uid()) or has_role(auth.uid(), 'secretaire')) then
    raise exception 'Réservé à l''encadrement et au secrétariat.';
  end if;

  for r in
    select tr.id as rental_id, tr.weekday, tr.start_time, tr.end_time, tr.courts,
           t.name as tenant, t.kind
      from tenant_rentals tr
      join court_tenants t on t.id = tr.tenant_id
     where tr.season_label = p_season
       and coalesce(t.active, true)
     order by tr.weekday, tr.start_time, t.name
  loop
    v_titre := r.tenant;
    -- Un club ou un externe paie le tarif non-membre : son bloc le dit.
    v_defaut := case when r.kind = 'membre' then 'Membre-hiver' else 'Non-membre hiver' end;
    select ct.id, ct.color into v_type, v_couleur
      from course_types ct
     where ct.hours_bucket = 'location'
       and ct.name = case when r.tenant = 'Xavier Schumacher' then 'Privé Schumacher' else r.tenant end
     limit 1;
    if v_type is null then
      select ct.id, ct.color into v_type, v_couleur
        from course_types ct where ct.hours_bucket = 'location' and ct.name = v_defaut limit 1;
    end if;
    if v_type is null then
      raise exception 'Type de cours « % » introuvable : appliquer db/181 d''abord.', v_defaut;
    end if;

    v_rec := md5(r.rental_id::text || ':' || p_season)::uuid;

    select array_agg(btrim(s.x)::int) into v_courts
      from unnest(string_to_array(coalesce(r.courts, ''), ',')) s(x)
     where btrim(s.x) ~ '^\d+$';

    foreach v_court in array coalesce(v_courts, '{}'::int[])
    loop
      d := p_from + ((r.weekday - extract(isodow from p_from)::int + 7) % 7);
      while d <= p_to loop
        if not exists (select 1 from courts c
                        where c.id = v_court and c.open_winter and coalesce(c.is_active, true)) then
          v_ferme := v_ferme + 1;
        elsif exists (select 1 from courses co
                       where co.recurrence_id = v_rec and co.course_date = d
                         and co.start_time = r.start_time) then
          v_deja := v_deja + 1;
        else
          select string_agg(coalesce(b.title, 'réservation'), ', ') into v_clash
            from court_bookings b
           where b.court_id = v_court and b.booking_date = d
             and b.start_time < r.end_time and b.end_time > r.start_time;
          if v_clash is not null then
            v_conflits := v_conflits || jsonb_build_object(
              'date', d, 'court', v_court, 'heure', to_char(r.start_time, 'HH24:MI'),
              'locataire', r.tenant, 'occupe_par', v_clash);
          elsif p_apply then
            insert into courses (course_type_id, title, course_date, start_time, end_time,
                                 color, notes, recurrence_id, created_by)
            values (v_type, v_titre, d, r.start_time, r.end_time, v_couleur,
                    'Abonnement hiver ' || p_season
                      || ' — créneau de Répertoire › Locations de courts. Ne compte dans aucune heure de coach.',
                    v_rec, auth.uid())
            returning id into v_course;
            insert into court_bookings (court_id, booking_date, start_time, end_time,
                                        kind, title, color, created_by, course_id, recurrence_id)
            values (v_court, d, r.start_time, r.end_time, 'cours', v_titre, v_couleur,
                    auth.uid(), v_course, v_rec);
            v_cree := v_cree + 1;
          else
            v_cree := v_cree + 1;
            if jsonb_array_length(v_prevu) < 12 then
              v_prevu := v_prevu || jsonb_build_object(
                'date', d, 'court', v_court, 'heure', to_char(r.start_time, 'HH24:MI'),
                'locataire', r.tenant);
            end if;
          end if;
        end if;
        d := d + 7;
      end loop;
    end loop;
  end loop;

  return jsonb_build_object(
    'applique', p_apply, 'saison', p_season, 'du', p_from, 'au', p_to,
    'crees', v_cree, 'deja_en_place', v_deja, 'courts_fermes', v_ferme,
    'conflits', v_conflits, 'apercu', v_prevu);
end $$;
