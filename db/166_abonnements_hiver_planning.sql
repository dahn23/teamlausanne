-- ===================================================================
--  PLANNING › les abonnements d'hiver posés sur la grille (16.10.2026)
-- ===================================================================
-- Les créneaux loués pour l'hiver existent déjà, saisis une fois dans
-- Répertoire › Locations de courts : jour, heure, court, montant. Ils servaient
-- à facturer, et à rien d'autre — le planning de l'école de tennis les
-- ignorait. On ne voyait donc nulle part la semaine complète, et on pouvait
-- réserver un court loué à un club pour toute la saison.
--
-- Cette fonction déroule ces créneaux en blocs de planning, du 26 octobre à la
-- fin de la saison d'hiver (14 avril : season_of() fait commencer l'été le 15).
--
-- TROIS CHOSES QU'ELLE NE FAIT PAS, ET C'EST VOULU :
--
--  · Elle ne compte AUCUNE heure de coach. Les types utilisés sont dans le
--    panier 'location' (db/165), exclu des décomptes, des fiches de salaire,
--    de la paie par saison et de l'export fiduciaire. Un club qui loue un
--    court ne donne pas de leçon.
--
--  · Elle n'écrase RIEN. Un créneau qui chevauche un cours déjà posé n'est pas
--    créé : il est RENVOYÉ dans la liste des conflits, à trancher à la main.
--    Écraser un cours de l'école pour y mettre une location serait le pire
--    service à rendre.
--
--  · Elle ne crée rien tant qu'on ne le demande pas. p_apply = false (défaut)
--    est un essai à blanc : on voit ce qui serait créé, ce qui entre en
--    conflit, et combien. Sept créneaux sur vingt-cinq semaines font quelques
--    centaines de blocs — on ne lance pas ça à l'aveugle.
--
-- Relancer la fonction est SANS DANGER : chaque bloc porte le recurrence_id du
-- créneau dont il vient, donc un bloc déjà posé est reconnu et sauté. On peut
-- donc l'exécuter après avoir ajouté un créneau dans le Répertoire : seuls les
-- blocs manquants apparaissent.

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
  v_course uuid; v_clash text; v_titre text;
begin
  -- Mêmes droits que pour poser un cours à la main (policy courses_write).
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
    -- Le type de cours porte le nom du locataire. « Xavier Schumacher » est
    -- l'unique alias : son type s'appelle « Privé Schumacher » (c'est ainsi
    -- qu'on le désigne au club). Tout locataire sans type nommé retombe sur
    -- « Membre » — mieux vaut un bloc générique qu'un bloc manquant.
    v_titre := r.tenant;
    select ct.id, ct.color into v_type, v_couleur
      from course_types ct
     where ct.hours_bucket = 'location'
       and ct.name = case when r.tenant = 'Xavier Schumacher' then 'Privé Schumacher' else r.tenant end
     limit 1;
    if v_type is null then
      select ct.id, ct.color into v_type, v_couleur
        from course_types ct where ct.hours_bucket = 'location' and ct.name = 'Membre' limit 1;
    end if;
    if v_type is null then
      raise exception 'Aucun type de cours « location » en base : appliquer db/165 d''abord.';
    end if;

    -- Un recurrence_id par créneau, calculé (pas tiré au hasard) : c'est lui
    -- qui rend la fonction rejouable et le ménage possible.
    v_rec := md5(r.rental_id::text || ':' || p_season)::uuid;

    -- « 5, 6 » = deux courts, donc deux blocs : la grille est par court.
    select array_agg(btrim(s.x)::int) into v_courts
      from unnest(string_to_array(coalesce(r.courts, ''), ',')) s(x)
     where btrim(s.x) ~ '^\d+$';

    foreach v_court in array coalesce(v_courts, '{}'::int[])
    loop
      d := p_from + ((r.weekday - extract(isodow from p_from)::int + 7) % 7);
      while d <= p_to loop
        -- Court fermé l'hiver : on ne pose rien, on le compte et on le dit.
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

revoke all on function public.winter_rentals_generate(text, date, date, boolean) from public, anon;
grant execute on function public.winter_rentals_generate(text, date, date, boolean) to authenticated;

-- ---- Le ménage ------------------------------------------------------
-- Indispensable : poser quelques centaines de blocs sans pouvoir les retirer
-- d'un geste, c'est une décision qu'on n'ose plus prendre. Ne touche QUE les
-- blocs générés (reconnus à leur recurrence_id), jamais un cours saisi à la
-- main, même s'il porte le même nom.
create or replace function public.winter_rentals_clear(
  p_season text, p_from date default date '2026-10-26', p_to date default date '2027-04-14'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ids uuid[]; v_n int;
begin
  if not (is_head(auth.uid()) or has_role(auth.uid(), 'secretaire')) then
    raise exception 'Réservé à l''encadrement et au secrétariat.';
  end if;
  select array_agg(md5(tr.id::text || ':' || p_season)::uuid) into v_ids
    from tenant_rentals tr where tr.season_label = p_season;
  if v_ids is null then return jsonb_build_object('supprimes', 0); end if;
  -- Les réservations de court partent avec : court_bookings.course_id n'est pas
  -- forcément en cascade, et un blocage orphelin interdirait le court sans que
  -- rien n'apparaisse au planning.
  delete from court_bookings b
   where b.recurrence_id = any(v_ids) and b.booking_date between p_from and p_to;
  delete from courses co
   where co.recurrence_id = any(v_ids) and co.course_date between p_from and p_to;
  get diagnostics v_n = row_count;
  return jsonb_build_object('supprimes', v_n, 'saison', p_season);
end $$;

revoke all on function public.winter_rentals_clear(text, date, date) from public, anon;
grant execute on function public.winter_rentals_clear(text, date, date) to authenticated;
