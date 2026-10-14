-- Reprendre les créneaux d'un locataire depuis la Saison hiver (14.10.2026).
--
-- Le secrétariat écrit déjà le nom du club dans les cases du planning d'hiver
-- (« TC Montchoisi » sur dix cases). Les retaper une à une dans la fiche du
-- locataire, c'est le même travail deux fois, et deux occasions de diverger :
-- un créneau déplacé dans le planning laissait la facture inchangée.
--
-- Cette fonction lit le planning et rend des lignes de location prêtes à
-- poser. Le prix n'est pas inventé : c'est celui que la grille affiche déjà,
-- avec les mêmes règles (membre / non-membre, heure pleine / heure creuse),
-- lues aux mêmes endroits — app_settings 'sub_prices' et 'peak'. Un seul
-- barème, donc la facture ne peut pas contredire l'écran.
--
-- Attention au sens du prix : il est PAR SAISON et par créneau hebdomadaire,
-- pas par heure. Une case « non-membre, heure pleine » vaut 1 100.– pour tout
-- l'hiver. C'est pourquoi la ligne produite remplit `amount_chf` (le forfait)
-- et laisse le tarif horaire vide : « heures × tarif » n'aurait aucun sens ici.
--
-- Les cases qui se suivent sur le même court fusionnent en une seule ligne
-- (mercredi 14h15–17h15 plutôt que trois lignes d'une heure), et les courts
-- occupés à la même heure le même jour se rassemblent (« 4, 6 ») : c'est ainsi
-- qu'on le dirait à la famille, et ainsi que ça se lit sur la facture.

create or replace function public.winter_rentals_for(p_name text, p_season text)
returns table(weekday smallint, start_time time, end_time time,
              courts text, hours numeric, amount_chf numeric, label text)
language sql stable security definer set search_path to 'public' as $function$
  with reglages as (
    select (select value from app_settings where key = 'sub_prices') as prix,
           (select value from app_settings where key = 'peak')       as peak
  ),
  -- 1. Les cases du club, avec leur heure, leur caractère plein/creux et leur prix.
  cellules as (
    select w.day, w.court, w.slot,
           case when w.status in ('membre', 'pre_m')
                then (r.prix ->> (case when (r.peak -> w.day::text) @> to_jsonb(8 + w.slot)
                                       then 'hiver_membre_pleine' else 'hiver_membre_creuse' end))::numeric
                else (r.prix ->> (case when (r.peak -> w.day::text) @> to_jsonb(8 + w.slot)
                                       then 'hiver_nonmembre_pleine' else 'hiver_nonmembre_creuse' end))::numeric
           end as prix
      from winter_plan w, reglages r
     where w.season = p_season
       and w.status in ('membre', 'pre_m', 'normal', 'pre_nm')   -- gratuit et libre ne se facturent pas
       and lower(btrim(coalesce(w.player_name, ''))) = lower(btrim(p_name))
  ),
  -- 2. Les heures qui se suivent sur un même court forment un bloc. Astuce
  --    classique : slot − rang est constant tant que les slots se suivent.
  blocs as (
    select day, court, slot, prix,
           slot - row_number() over (partition by day, court order by slot) as bloc
      from cellules
  ),
  plages as (
    select day, court, min(slot) as du, max(slot) as au,
           count(*)::numeric as heures, sum(prix) as montant
      from blocs group by day, court, bloc
  )
  -- 3. Même jour, même tranche horaire, plusieurs courts → une seule ligne.
  select p.day::smallint,
         make_time(8 + p.du, 15, 0),
         make_time(9 + p.au, 15, 0),
         string_agg(p.court, ', ' order by p.court::int),
         sum(p.heures),
         sum(p.montant),
         case p.day when 1 then 'Lundi' when 2 then 'Mardi' when 3 then 'Mercredi'
                    when 4 then 'Jeudi' when 5 then 'Vendredi' when 6 then 'Samedi'
                    else 'Dimanche' end
         || ' ' || to_char(make_time(8 + p.du, 15, 0), 'HH24:MI')
         || '–' || to_char(make_time(9 + p.au, 15, 0), 'HH24:MI')
         || ' · court' || case when count(*) > 1 then 's ' else ' ' end
         || string_agg(p.court, ', ' order by p.court::int)
    from plages p
   group by p.day, p.du, p.au
   order by p.day, p.du;
$function$;

revoke all on function public.winter_rentals_for(text, text) from public, anon;
grant execute on function public.winter_rentals_for(text, text) to authenticated;

-- Essayé le 14.10.2026 sur TC Montchoisi, hiver 2026-2027 : dix cases, toutes
-- « tarif normal ». Quatre lignes — mercredi court 10 de 14h15 à 17h15
-- (3 300.–), jeudi courts 4 et 6 de 19h15 à 21h15 (4 400.–), vendredi court 5
-- de 16h15 à 19h15 (3 150.–, dont la première heure en creux à 950.–) — soit
-- 10 850.– au total, identique à la somme case par case.
