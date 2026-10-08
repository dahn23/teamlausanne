-- 142 — Un enfant ne s'inscrit plus deux fois au même stage.
--
-- Raphael, 08.10.2026 : « la pastille Stages affiche 14, pourquoi ? ». Elle
-- comptait 8 inscrits en Semaine 1 + 6 en Semaine 2 — sauf que sur ces 6, deux
-- lignes étaient le MÊME enfant.
--
-- Francesco Rossetti, Loisir journée, Semaine 2, inscrit deux fois :
--   · 03.10 12h10 — formulaire public, né « 2013-04-13 », t-shirt 12-14 ans,
--     non rattaché au répertoire (il attendait dans stage_link_review).
--   · 07.10 06h50 — ajouté à la main dans la console, né « 2013-04-09 »,
--     rattaché à sa fiche.
-- Le répertoire dit 09.04.2013 : la ligne du 3 octobre porte une date tapée de
-- travers, et quelqu'un l'a ré-inscrit à la main quatre jours plus tard sans
-- voir la première.
--
-- Trois conséquences, toutes silencieuses :
--   · la pastille annonçait 14 inscrits au lieu de 13 ;
--   · le décompte des repas commandait 2 Loisir journée en Semaine 2 pour un
--     seul enfant, soit 5 repas de trop sur la semaine ;
--   · le mail d'avant-stage serait parti deux fois chez le même parent — la
--     clé de stage_mail_sent protège par INSCRIPTION, et il y en avait deux.
--
-- On garde la ligne du 7 octobre (bonne date, rattachée au répertoire) et on
-- reporte d'abord la taille de t-shirt, que seule la ligne du 3 portait.
--
-- Puis un INDEX UNIQUE, et pas un contrôle dans le formulaire : cinq endroits
-- insèrent dans stage_registrations (le site public, la page stage autonome,
-- index.js, Mon espace, et la console) et un garde-fou côté navigateur se
-- contourne. La clé est (stage, catégorie, prénom, nom) en minuscules et sans
-- espaces superflus — « carlos tejero » est déjà en base tout en minuscules.
--
-- Pas l'e-mail dans la clé : deux parents séparés inscrivent le même enfant
-- avec deux adresses, et ce serait alors un vrai doublon qui passerait.
-- La catégorie, elle, reste dans la clé : le même enfant peut légitimement
-- faire le Loisir matin ET autre chose sur la même semaine.

begin;

-- 1. La taille de t-shirt, avant de perdre la ligne qui la portait.
update public.stage_registrations
   set tshirt_size = '12-14 ans'
 where id = '878ebb9d-8c76-4e9f-9cd6-72a43b802fb5'
   and tshirt_size is null;

-- 2. Le doublon. Aucune facture, aucun mail parti : rien à reprendre d'autre.
--    Sa ligne d'attente dans stage_link_review part avec (ON DELETE CASCADE).
delete from public.stage_registrations
 where id = '2c42b77e-5307-44b0-b754-91eba90444fd';

commit;

-- ---------------------------------------------------------------------------
-- 3. Le garde-fou. Hors transaction : si des doublons restaient ailleurs, on
--    veut que la création échoue bruyamment sans annuler le nettoyage ci-dessus.
--    Vérifié le 08.10.2026 : Francesco était le seul de toute la table.

create unique index if not exists stage_registrations_pas_deux_fois
  on public.stage_registrations
     (stage_id, category_id, lower(trim(first_name)), lower(trim(last_name)));

comment on index public.stage_registrations_pas_deux_fois is
  'Un enfant une seule fois par stage et par catégorie. Violation = code 23505, que les formulaires traduisent en français.';
