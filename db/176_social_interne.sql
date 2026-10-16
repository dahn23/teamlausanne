-- ===================================================================
--  Social Media Planner : un outil d'équipe, pas un droit de coach
-- ===================================================================
-- Décision du 16.10.2026 : le planner s'adresse au staff interne — Dan,
-- Raphael, Renato, Arsalan, Séline, Mariano. Les coachs, moniteurs, profs et
-- coachs mentaux n'en ont pas besoin.
--
-- can_social() les incluait tous les neuf rôles ; l'écriture, elle, était déjà
-- juste (can_social_edit = superadmin, admin, secrétariat). On aligne donc la
-- lecture sur l'écriture, et les vingt policies social_* suivent sans qu'on y
-- touche : elles passent toutes par ces deux portes.
--
-- MARIANO. Il est head_coach, et c'est le seul head coach concerné : mettre
-- 'head_coach' dans la liste donnerait l'onglet à tout futur head coach, ce
-- qui n'est pas la demande. On passe donc par tab_allow, le mécanisme nominatif
-- déjà prévu pour exactement ce cas — et où il figure déjà, pour le Project
-- Manager. Son commentaire dans admin.js le dit : « certains outils
-- s'adressent à des personnes plutôt qu'à des fonctions ».
--
-- La porte lit donc tab_allow, pour que l'onglet et les DONNÉES s'ouvrent
-- ensemble. Sans cela Mariano verrait l'onglet et un écran vide.

create or replace function public.can_social(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
                  and role in ('superadmin','admin','secretaire'))
      or coalesce((select (s.value -> uid::text) ? 'social'
                     from app_settings s where s.key = 'tab_allow'), false);
$$;

-- Mariano : on AJOUTE 'social' sans toucher à son 'pm', et sans le doubler si
-- quelqu'un relance ce fichier.
update app_settings
   set value = jsonb_set(
         value,
         array['49de84a7-f588-4558-a8ae-df7b95a8f441'],
         coalesce(value -> '49de84a7-f588-4558-a8ae-df7b95a8f441', '[]'::jsonb)
           || '["social"]'::jsonb,
         true)
 where key = 'tab_allow'
   and not coalesce((value -> '49de84a7-f588-4558-a8ae-df7b95a8f441') ? 'social', false);
