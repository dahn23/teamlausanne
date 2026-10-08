-- 139 — Le décompte des repas : les exceptions, et les coachs comptés une fois.
--
-- Raphael, 08.10.2026 : « il n'y a de repas que pour les Loisirs journée,
-- Entraîne-toi comme un pro et les exceptions, plus les coachs concernés ».
-- La règle de base était déjà juste — stage_categories.meal porte Loisir
-- journée et Entraîne-toi comme un pro — mais deux choses clochaient.
--
-- 1. AUCUNE EXCEPTION POSSIBLE. Joël Grumelli est en « Loisir matin » (sans
--    repas) et son père a demandé qu'il mange ; sa facture porte d'ailleurs
--    les 100.— depuis db/137. Rien ne permettait de le dire au décompte : il
--    manquait aux repas commandés alors qu'il les payait.
--
--    D'où une colonne « meal » à trois états sur l'inscription :
--      NULL  → on suit la catégorie (le cas de presque tout le monde)
--      true  → mange malgré une catégorie sans repas  (Joël)
--      false → ne mange pas malgré une catégorie avec repas (allergie,
--              parent qui vient chercher l'enfant à midi…)
--    Un booléen simple aurait obligé à figer un choix pour chaque inscrit et
--    à le maintenir quand une catégorie change d'avis.
--
-- 2. UN COACH SUR DEUX CATÉGORIES ÉTAIT COMPTÉ DEUX FOIS. stage_staff a une
--    ligne par (session, catégorie) : Célyan Lorival encadre le Loisir
--    journée ET le Loisir matin de la semaine 1, donc deux lignes. Le
--    décompte faisait « stgStaff.length », soit trois encadrants pour deux
--    personnes — et deux repas pour un seul estomac. Corrigé côté console en
--    comptant les personnes distinctes.
--
-- Semaine 1 du stage d'automne, après correction : 4 Loisir journée + Joël
-- + 2 coachs = 7 repas par jour. L'ancien calcul tombait aussi sur 7, mais
-- par compensation de deux erreurs — Joël manquant, Célyan compté double.

begin;

alter table public.stage_registrations
  add column if not exists meal boolean;

comment on column public.stage_registrations.meal is
  'Repas de midi : NULL = comme la catégorie, true = mange quand même, false = ne mange pas. Ne sert qu''au décompte des repas, jamais au prix (une exception se facture à la main).';

-- L'exception qui a motivé le fichier.
update public.stage_registrations
   set meal = true
 where id = '398ca433-8ef6-4967-8d58-ccfcc9a21f5f';   -- Joël Grumelli, Loisir matin

commit;
