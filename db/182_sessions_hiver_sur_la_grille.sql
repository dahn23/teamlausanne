-- ===================================================================
--  RÉSERVATIONS › les sessions d'hiver posées sur la grille (16.10.2026)
-- ===================================================================
-- Demande : voir toutes les sessions d'hiver sur le panneau de réservation,
-- nommées, en jaune — et surtout SANS qu'elles touchent à quoi que ce soit.
-- Pas d'heures de coach, pas de présences, pas de facturation.
--
-- D'où le choix de ne PAS créer de cours. Un cours entraîne un type, des
-- coachs, un appel, des heures, et un jour quelqu'un validerait l'un d'eux.
-- Ici on écrit directement des réservations de court : une ligne dans
-- court_bookings sans course_id n'a ni coach ni présence ni heure, par
-- construction et pas par discipline. Le seul effet est d'occuper la case.
--
-- CE QUI EST POSÉ : tout ce que le planning d'hiver marque « membre »,
-- « normal » ou « pre_m » — les clubs, les externes, les membres, et les cases
-- d'Ivan, qui n'est pas un locataire facturable mais occupe bien le court.
-- Ce qui est marqué « gratuit » est exclu : ce sont les cours de l'académie,
-- qui existent déjà sur la grille et qu'on ne touche pas.
--
-- RIEN N'EST ÉCRASÉ. Une case déjà occupée — un cours de l'école, un
-- sport-études, une réservation d'un membre — est SIGNALÉE et sautée. On ne
-- superpose pas une session d'hiver à un cours existant pour faire joli.
--
-- Le jaune est dans la couleur de la réservation (court_bookings.color), lue
-- par la grille de la console. La page publique, elle, affiche « Réservé »
-- sans le nom pour toute réservation qui n'est pas un cours : un membre n'a
-- pas à savoir qui loue le court d'à côté, et c'est très bien ainsi.

alter table court_bookings drop constraint if exists court_bookings_kind_check;
alter table court_bookings add constraint court_bookings_kind_check
  check (kind = any (array['libre', 'cours', 'tournoi', 'maintenance', 'hiver']));

create or replace function public.winter_sessions_to_bookings(
  p_plan_season text    default '2026-2027',
  p_from        date    default date '2026-10-26',
  p_to          date    default date '2027-04-14',
  p_apply       boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_jaune constant text := '#facc15';
  v_cree int := 0; v_deja int := 0; v_ferme int := 0;
  v_conflits jsonb := '[]'::jsonb; v_noms jsonb := '[]'::jsonb;
  r record; d date; v_rec uuid; v_clash text;
begin
  if not (is_head(auth.uid()) or has_role(auth.uid(), 'secretaire')) then
    raise exception 'Réservé à l''encadrement et au secrétariat.';
  end if;

  drop table if exists _sess;
  create temp table _sess on commit drop as
  with cel as (
    select w.player_name, w.day, w.court::int as court, w.slot
      from winter_plan w
     where w.season = p_plan_season
       and w.status in ('membre', 'normal', 'pre_m')
       and coalesce(w.player_name, '') <> ''
       and w.court ~ '^[0-9]+$'          -- « Fitness » n'est pas un court de la grille
  ),
  -- Heures contiguës d'un même nom sur un même court : « 17:15–21:15 » plutôt
  -- que quatre blocs collés qu'on lirait comme quatre réservations.
  ilots as (
    select *, slot - row_number() over (partition by player_name, day, court order by slot) as grp
      from cel
  )
  select player_name, day, court, min(slot) as s1, max(slot) as s2, count(*)::int as h
    from ilots
   group by player_name, day, court, grp;

  select coalesce(jsonb_agg(jsonb_build_object('nom', x.player_name, 'creneaux', x.n)
           order by x.n desc, x.player_name), '[]'::jsonb) into v_noms
    from (select player_name, count(*)::int as n from _sess group by player_name) x;

  for r in select * from _sess order by day, s1, court loop
    v_rec := md5(p_plan_season || ':' || r.player_name || ':' || r.day || ':' || r.court || ':' || r.s1)::uuid;
    d := p_from + ((r.day - extract(isodow from p_from)::int + 7) % 7);
    while d <= p_to loop
      if not exists (select 1 from courts c
                      where c.id = r.court and c.open_winter and coalesce(c.is_active, true)) then
        v_ferme := v_ferme + 1;
      elsif exists (select 1 from court_bookings b
                     where b.recurrence_id = v_rec and b.booking_date = d) then
        v_deja := v_deja + 1;
      else
        select string_agg(coalesce(b.title, b.kind), ', ') into v_clash
          from court_bookings b
         where b.court_id = r.court and b.booking_date = d
           and b.start_time < ((9 + r.s2) * interval '1 hour' + interval '15 min')::time
           and b.end_time   > ((8 + r.s1) * interval '1 hour' + interval '15 min')::time;
        if v_clash is not null then
          if jsonb_array_length(v_conflits) < 40 then
            v_conflits := v_conflits || jsonb_build_object(
              'date', d, 'court', r.court, 'heure', to_char((8 + r.s1) * interval '1 hour' + interval '15 min', 'HH24:MI'),
              'session', r.player_name, 'occupe_par', v_clash);
          end if;
        elsif p_apply then
          insert into court_bookings (court_id, booking_date, start_time, end_time,
                                      kind, title, color, created_by, recurrence_id)
          values (r.court, d,
                  ((8 + r.s1) * interval '1 hour' + interval '15 min')::time,
                  ((9 + r.s2) * interval '1 hour' + interval '15 min')::time,
                  'hiver', r.player_name, v_jaune, auth.uid(), v_rec);
          v_cree := v_cree + 1;
        else
          v_cree := v_cree + 1;
        end if;
      end if;
      d := d + 7;
    end loop;
  end loop;

  return jsonb_build_object('applique', p_apply, 'saison', p_plan_season,
    'du', p_from, 'au', p_to, 'crees', v_cree, 'deja_en_place', v_deja,
    'courts_fermes', v_ferme, 'noms', v_noms,
    'nb_conflits', (select count(*) from _sess) * 0 + jsonb_array_length(v_conflits),
    'conflits', v_conflits);
end $$;

revoke all on function public.winter_sessions_to_bookings(text, date, date, boolean) from public, anon;
grant execute on function public.winter_sessions_to_bookings(text, date, date, boolean) to authenticated;

-- Le ménage : ne retire que les réservations posées par cette fonction
-- (kind = 'hiver'), jamais un cours ni une réservation de membre.
create or replace function public.winter_sessions_clear(
  p_from date default date '2026-10-26', p_to date default date '2027-04-14'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not (is_head(auth.uid()) or has_role(auth.uid(), 'secretaire')) then
    raise exception 'Réservé à l''encadrement et au secrétariat.';
  end if;
  delete from court_bookings
   where kind = 'hiver' and booking_date between p_from and p_to;
  get diagnostics n = row_count;
  return jsonb_build_object('supprimes', n);
end $$;
revoke all on function public.winter_sessions_clear(date, date) from public, anon;
grant execute on function public.winter_sessions_clear(date, date) to authenticated;

-- ---- Le titre affiché sur le bloc ----------------------------------
-- La grille d'hiver est un document de travail : on y écrit « Pellaz -150 de
-- crédit » ou « Nathalie Des Termes 850 (membre-hiver)-178=672 ». Le prix
-- griffonné n'a rien à faire sur un bloc de réservation.
--
-- On coupe donc au premier mot qui porte un chiffre — c'est là que commencent
-- les prix — et on raccroche le suffixe entre parenthèses s'il n'en contient
-- pas, pour garder « (membre-hiver) ». Le reste est repris tel quel,
-- majuscules comprises : c'est le mot choisi par le secrétariat, pas à nous
-- de le réécrire.
--
--   « Pellaz -150 de crédit »                        → « Pellaz »
--   « Geerinckx (500) (membre-hiver) »               → « Geerinckx (membre-hiver) »
--   « Nathalie Des Termes 850 (membre-hiver)-178=672 » → « Nathalie Des Termes (membre-hiver) »
--   « Romeo Franco (Raiffeisen) »                    → inchangé
create or replace function public.wp_titre(p text)
returns text language sql immutable as $$
  with net as (
    select btrim(regexp_replace(split_part(regexp_replace(coalesce(p,''), '\s+', ' ', 'g'),
             (select coalesce((regexp_match(coalesce(p,''), '(\S*[0-9]\S*)'))[1], chr(1))), 1),
           '\s+', ' ', 'g')) as tete,
           (regexp_match(coalesce(p,''), '(\([^)0-9]+\))')) as suffixe
  )
  select btrim(case
    when suffixe is not null and position(suffixe[1] in tete) = 0
      then tete || ' ' || suffixe[1]
    else tete end)
    from net;
$$;
revoke all on function public.wp_titre(text) from public, anon;
grant execute on function public.wp_titre(text) to authenticated;

-- Résultat mesuré le 16.10.2026 : 1343 réservations posées, 26 noms, aucune
-- rattachée à un cours ; 14 créneaux sautés car la case était déjà prise
-- (tous dans la seule semaine déjà planifiée, et tous des doublons de cours
-- déjà saisis — « Privé Schumacher », « Cours adultes »).
