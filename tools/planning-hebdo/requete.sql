-- Séances de la semaine pour les jeunes élite (sport-études, pro, pro U18),
-- au format attendu par gen.cjs : une ligne par séance,
--   Nom Prénom|filiere|JJ|HH:MM|HH:MM|Type de cours|Coachs|Courts
--
-- Remplacer les DEUX dates ci-dessous par le lundi et le vendredi de la
-- semaine voulue, exécuter, et coller le résultat dans seances.txt.
--
-- Notes :
--  · la fiche de test de Dan (dan@katapultapp.com) est écartée — elle a un
--    rôle de filière de la saison courante et compterait comme un joueur ;
--  · un joueur sans séance n'apparaît pas : pas de ligne, donc pas de PDF.
--    C'est voulu — une page vide dirait à une famille « rien cette semaine »,
--    ce qui est le plus souvent un trou dans le planning, pas une réalité.
--    Comparer avec les semaines précédentes avant d'envoyer (cf. README).

with cur as (
  select id from seasons
  where kind = 'juniors' and current_date between start_date and end_date
),
elite as (
  select p.id, p.first_name || ' ' || p.last_name as nom, rp.role as filiere
  from people p
  join role_periods rp on rp.person_id = p.id and rp.season_id = (select id from cur)
  where rp.role in ('pro', 'pro-u18', 'sport-etudes')
    and coalesce(p.is_active, true)
    and lower(coalesce(p.email, '')) <> 'dan@katapultapp.com'
),
s as (
  select e.nom, e.filiere, c.course_date as d, c.start_time,
         to_char(c.start_time, 'HH24:MI') as h1,
         to_char(c.end_time,   'HH24:MI') as h2,
         ct.name as type,
         coalesce((select string_agg(co.first_name || ' ' || co.last_name, ', ' order by co.first_name)
                     from course_coaches cc
                     join people co on co.id = cc.coach_person_id
                    where cc.course_id = c.id), '') as coach,
         coalesce((select string_agg(x.name, ', ' order by x.display_order)
                     from (select distinct ct2.name, ct2.display_order
                             from court_bookings b
                             join courts ct2 on ct2.id = b.court_id
                            where b.course_id = c.id) x), '') as court
  from elite e
  join course_participants cp on cp.child_person_id = e.id
  join courses c on c.id = cp.course_id
                and c.course_date between date '2026-11-09' and date '2026-11-13'   -- ← lundi … vendredi
  left join course_types ct on ct.id = c.course_type_id
)
select string_agg(
         nom || '|' || filiere || '|' || to_char(d, 'DD') || '|' || h1 || '|' || h2
             || '|' || type || '|' || coach || '|' || court,
         E'\n' order by nom, d, start_time) as lignes
from s;

-- Contrôle à passer AVANT d'envoyer : qui perd ses séances d'une semaine à
-- l'autre ? Une colonne qui tombe à zéro est presque toujours un oubli de
-- saisie. (Adapter les trois paires de dates.)
--
--   with cur as (select id from seasons where kind='juniors' and current_date between start_date and end_date),
--   elite as (select p.id, p.first_name||' '||p.last_name as nom
--             from people p join role_periods rp on rp.person_id=p.id and rp.season_id=(select id from cur)
--             where rp.role in ('pro','pro-u18','sport-etudes') and coalesce(p.is_active,true))
--   select e.nom,
--     count(*) filter (where c.course_date between '2026-10-26' and '2026-10-30') as il_y_a_deux_sem,
--     count(*) filter (where c.course_date between '2026-11-02' and '2026-11-06') as semaine_en_cours,
--     count(*) filter (where c.course_date between '2026-11-09' and '2026-11-13') as semaine_a_venir
--   from elite e
--   left join course_participants cp on cp.child_person_id = e.id
--   left join courses c on c.id = cp.course_id
--   group by e.nom order by semaine_a_venir, e.nom;
