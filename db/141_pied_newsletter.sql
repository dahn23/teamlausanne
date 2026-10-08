-- 141 — Le pied de page des newsletters devient cliquable.
--
-- Raphael, 08.10.2026 : le pied doit porter l'identité, l'adresse et les trois
-- façons de nous joindre, et chaque libellé doit mener quelque part — le nom de
-- l'académie vers la fiche Google pour y déposer un avis, le site vers le site,
-- l'adresse e-mail vers un message, le @ vers Instagram.
--
-- Le vrai défaut était ailleurs : le modèle par défaut (NL_MODELES.pied, dans
-- admin.js) portait encore « Chemin du Stade 3, 1007 Lausanne ». Chaque
-- newsletter partait donc avec la mauvaise adresse, et Raphael la corrigeait à
-- la main une fois sur deux — d'où trois graphies différentes dans les cinq
-- newsletters existantes. Le modèle est corrigé côté console ; les nouvelles
-- naissent désormais justes et cliquables.
--
-- Ici, on ne reprend que le BROUILLON. Les quatre autres sont parties : leur
-- HTML est l'archive de ce que les familles ont reçu, et on ne réécrit pas le
-- passé. Le brouillon, lui, n'est pas encore lu par personne.
--
-- On touche aux deux colonnes. « blocks » est ce que l'éditeur relit, « html »
-- ce que l'envoi expédie : ne corriger que la première laisserait partir
-- l'ancien pied si Raphael envoyait sans repasser par l'éditeur.

begin;

-- Le pied, écrit une fois ; identique à NL_PIED dans admin.js.
create temporary table pied_neuf as
select '<a href="https://www.google.com/maps/search/?api=1&query=Team+Lausanne+Academy+Route+des+Plaines-du-Loup+7+1018+Lausanne" style="color:#69708a;text-decoration:underline">Team Lausanne Academy</a>'
    || ' · Route des Plaines du Loup 7, 1018 Lausanne<br />'
    || '<a href="https://teamlausanne.ch" style="color:#69708a;text-decoration:underline">teamlausanne.ch</a> · '
    || '<a href="mailto:info@teamlausanne.ch" style="color:#69708a;text-decoration:underline">info@teamlausanne.ch</a> · '
    || '<a href="https://www.instagram.com/lausanne_sports_tennis/" style="color:#69708a;text-decoration:underline">@lausanne_sports_tennis</a>'
  as h;

-- blocks : on remplace le html du seul bloc de type « pied ».
update public.newsletters n
   set blocks = (
         select jsonb_agg(
                  case when b->>'t' = 'pied'
                       then jsonb_set(b, '{html}', to_jsonb((select h from pied_neuf)))
                       else b end
                  order by o)
           from jsonb_array_elements(n.blocks) with ordinality t(b, o)
       ),
       -- html : l'ancien pied compilé, remplacé par le neuf au même endroit.
       html = replace(n.html,
                'Team Lausanne Academy · Route des Plaines du Loup 7, 1018 Lausanne<br><a href="https://teamlausanne.ch" style="color:#69708a">teamlausanne.ch</a> · <a href="mailto:info@teamlausanne.ch" style="color:#69708a">info@teamlausanne.ch</a>&nbsp;· @lausanne_sports_tennis',
                (select h from pied_neuf))
 where n.id = 'fceb021e-fcda-4e1c-ac8e-055552e0251a'
   and n.status = 'brouillon';

commit;

-- Contrôle : le brouillon doit afficher 4 liens dans son pied, et plus aucune
-- mention du @ Instagram en texte brut.
--   select (select b->>'html' from jsonb_array_elements(blocks) b where b->>'t'='pied'),
--          position('text-decoration:underline">@lausanne' in html)
--     from public.newsletters where id = 'fceb021e-fcda-4e1c-ac8e-055552e0251a';
