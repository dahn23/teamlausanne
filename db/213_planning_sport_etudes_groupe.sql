-- 213 — La planification validée de Célyan, posée sur tout le groupe sport-études.
--
-- Une fois sa frise relue et corrigée (db/211, db/212), elle devient celle du
-- groupe : le planning sport-études est un planning de GROUPE, les écarts se
-- font ensuite joueur par joueur dans la console.
--
-- Dix jeunes, saison 2026/27 — la requête les retrouve d'elle-même, et on ne
-- les nomme pas ici : ce dossier est servi par Netlify, donc lisible de
-- l'extérieur par qui devine l'adresse.
--
-- CE QUI EST REMPLACÉ : leurs semaines et les zones tournoi posées par le
-- staff, sur les 52 semaines de la saison. Un seul en avait — et c'était la
-- copie de l'ancienne version de Célyan, rien d'individualisé. Les neuf
-- autres partaient d'une frise vide.
--
-- CE QUI N'EST JAMAIS TOUCHÉ : les inscriptions des jeunes à leurs propres
-- tournois (source 'joueur'). Aucune n'existait ici, mais la règle tient : la
-- planification du coach et les inscriptions du joueur sont deux choses, et
-- écraser l'une ne doit jamais effacer l'autre.
--
-- Les cibles sont tirées de role_periods plutôt que listées en dur : c'est la
-- filière de la saison qui dit qui est en sport-études, pas une liste figée.

begin;

create temporary table _cibles on commit drop as
  select rp.person_id
  from role_periods rp
  where rp.season_id = 'dcae97a4-2877-428e-b19c-9fb5797d4b89'   -- saison 2026/27
    and rp.role::text = 'sport-etudes'
    and rp.person_id <> '333cb7e9-d090-4052-a741-041abcaec015'; -- Célyan, la source

delete from plan_weeks w using _cibles c
 where w.person_id = c.person_id and w.week_start between '2026-08-31' and '2027-08-23';

delete from plan_tournaments t using _cibles c
 where t.person_id = c.person_id and t.source = 'staff'
   and t.week_start between '2026-08-31' and '2027-08-23';

insert into plan_weeks (person_id, week_start, kind, tennis, physique, note)
select c.person_id, s.week_start, s.kind, s.tennis, s.physique, s.note
from _cibles c
cross join (select week_start, kind, tennis, physique, note from plan_weeks
            where person_id = '333cb7e9-d090-4052-a741-041abcaec015'
              and week_start between '2026-08-31' and '2027-08-23') s;

-- Une seule zone par week-end, et son nom suit : « Tournoi », « Tournoi
-- possible » et « Tournoi / interclubs » ne disent pas la même chose.
insert into plan_tournaments (person_id, week_start, name, source)
select c.person_id, z.week_start, z.name, 'staff'
from _cibles c
cross join (select distinct on (week_start) week_start, name from plan_tournaments
            where person_id = '333cb7e9-d090-4052-a741-041abcaec015' and source = 'staff'
              and week_start between '2026-08-31' and '2027-08-23'
            order by week_start, created_at) z;

commit;

-- Résultat : 11 jeunes, 52 semaines chacun, 39 semaines de programme écrit,
-- 21 week-ends de compétition.
