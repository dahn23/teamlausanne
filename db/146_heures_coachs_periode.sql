-- 146 — Les heures d'un coach, lisibles depuis le planning.
--
-- Raphael, 09.10.2026 : « j'aimerais voir combien d'heures a un coach quand je
-- regarde l'onglet Réservation — chercher Gatiker et voir qu'il a X heures sur
-- la semaine ». La question se pose en construisant le planning, pas en
-- ouvrant l'onglet Heures.
--
-- Ce sont les heures PROGRAMMÉES, et non la paie : tout ce qui est au planning
-- compte, validé ou non, cours privés compris. L'onglet Heures, lui, ne compte
-- que le validé et applique les règles de rémunération. Les deux chiffres
-- peuvent donc différer — l'un sert à doser une charge, l'autre à payer. Mieux
-- vaut deux chiffres honnêtes qu'un seul qui ment à l'un des deux usages.
--
-- Le partage d'un cours entre plusieurs coachs suit la règle de l'onglet
-- Heures : minutes de segment si le cours est détaillé, durée entière sinon.
--
-- LE CONTRÔLE DE DROIT EST UNE GARDE, PAS UN MORCEAU DU WHERE. La première
-- version écrivait « where date between … and droit or role_secretaire » ;
-- AND liant plus fort que OR, cela se lisait « (date and droit) or role », et
-- le secrétariat recevait TOUTES les dates, la semaine demandée étant ignorée.
-- Une garde explicite en tête de fonction ne peut pas se tromper ainsi.

create or replace function public.coach_heures_periode(p_du date, p_au date)
returns table(person_id uuid, nom text, heures numeric, n_cours bigint)
language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if not (can_hours(auth.uid())
          or exists (select 1 from user_roles r where r.user_id = auth.uid() and r.role = 'secretaire')) then
    raise exception 'Accès refusé';
  end if;

  return query
    select cc.coach_person_id,
           pe.first_name || ' ' || pe.last_name,
           round(sum(case
               when course_is_detailed(c.id)
                 then coach_segment_minutes(c.id, cc.coach_person_id) / 60.0
               else extract(epoch from (c.end_time - c.start_time)) / 3600.0
             end)::numeric, 2),
           count(*)
      from courses c
      join course_coaches cc on cc.course_id = c.id
      join people pe on pe.id = cc.coach_person_id
     where c.course_date between p_du and p_au
     group by cc.coach_person_id, pe.first_name, pe.last_name
     order by 3 desc, 2;
end $function$;

revoke all on function public.coach_heures_periode(date, date) from public, anon;
grant execute on function public.coach_heures_periode(date, date) to authenticated;

-- Contrôle : sans session, la fonction doit refuser.
--   select * from coach_heures_periode('2026-10-06','2026-10-12');  -- Accès refusé
