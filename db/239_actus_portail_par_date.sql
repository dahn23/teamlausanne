-- 239 — Mon espace › Accueil : les actualités se lisent de la plus récente à la plus ancienne
-- (Raphael, 12.11.2026)
--
-- POURQUOI. Le fil du portail classait par PERTINENCE d'abord, par date ensuite. Un
-- article publié le jour même pouvait donc arriver en 5ᵉ position, sous des articles de
-- la semaine précédente — simplement parce que sa catégorie pesait moins pour la filière
-- de la famille. « Rencontre avec Mark », publié aujourd'hui, sortait 5ᵉ chez les
-- compétition et 4ᵉ chez les club, derrière des nouvelles plus vieilles.
--
-- Un article porte une date, et un lecteur qui revoit le même écran attend de trouver le
-- neuf en haut. C'est déjà la règle du site public (news_public : featured, puis date),
-- et les deux faces du même contenu se contredisaient.
--
-- CE QUI CHANGE : l'ORDRE d'affichage seulement — par date décroissante.
--
-- CE QUI NE CHANGE PAS, volontairement :
--   • QUELS articles sont retenus. Le poids par filière continue de choisir les cinq :
--     une famille kidstennis n'a pas à recevoir cinq nouvelles du circuit pro sous
--     prétexte qu'elles sont récentes.
--   • Le drapeau « pour_moi », qui colore l'article de sa propre filière.
--   • La garantie de la dernière ligne (« sienne ») : une famille voit toujours au moins
--     un article de SA filière, même s'il n'est pas dans les cinq plus pertinents. Il se
--     range désormais à sa date, donc plus bas s'il est ancien — c'est le prix du tri
--     chronologique, et c'est cohérent avec ce que le lecteur attend.

create or replace function public.portal_site_news(p_youth uuid default null, p_limit integer default 5)
returns table (slug text, title text, lede text, category text, cover_url text, cover_alt text,
               reading_min smallint, published_on date, pour_moi boolean)
language sql stable security definer set search_path to 'public' as $fn$
  with cibles as (
    select pid from my_family_ids() as pid where p_youth is null
    union all
    select p_youth where p_youth is not null
                     and (can_read_public_of(p_youth) or portal_peut_apercevoir())
  ),
  cur as (select s.id from seasons s
           where s.kind = 'juniors' and current_date between s.start_date and s.end_date
           limit 1),
  mes_filieres as (
    select rp.role from role_periods rp
      join cibles c on c.pid = rp.person_id
      join cur on cur.id = rp.season_id
    union
    select pr.role from person_roles pr join cibles c on c.pid = pr.person_id
  ),
  pertinence(role, categorie, poids) as (values
    ('*',            'Vie du club',   2),
    ('kidstennis',   'Kids Tennis',   3),
    ('kidstennis',   'Stages',        2),
    ('kidstennis',   'GameZone',      2),
    ('club',         'Club',          3),
    ('club',         'Stages',        2),
    ('club',         'GameZone',      2),
    ('club',         'Compétition',   2),
    ('competition',  'Compétition',   3),
    ('competition',  'Performance',   2),
    ('competition',  'Stages',        2),
    ('competition',  'Lausanne Open', 2),
    ('performance',  'Performance',   3),
    ('performance',  'Compétition',   2),
    ('performance',  'Sport-études',  2),
    ('performance',  'Lausanne Open', 2),
    ('performance',  'Nos coachs',    2),
    ('sport-etudes', 'Sport-études',  3),
    ('sport-etudes', 'Performance',   2),
    ('sport-etudes', 'Pro',           2),
    ('sport-etudes', 'Lausanne Open', 2),
    ('sport-etudes', 'Nos coachs',    2),
    ('pro',          'Pro',           3),
    ('pro',          'Sport-études',  2),
    ('pro',          'Lausanne Open', 2),
    ('pro',          'Nos coachs',    2),
    ('pro-u18',      'Pro',           3),
    ('pro-u18',      'Sport-études',  2),
    ('pro-u18',      'Lausanne Open', 2),
    ('pro-u18',      'Nos coachs',    2),
    ('adultes',      'Club',          2),
    ('adultes',      'Lausanne Open', 2),
    ('prive',        'Club',          2),
    ('membre',       'Club',          2),
    ('membre',       'Lausanne Open', 2)
  ),
  poids_cat as (
    select p.categorie, max(p.poids) as poids
      from pertinence p
     where p.role = '*' or p.role in (select role from mes_filieres)
     group by p.categorie
  ),
  tous as (
    select n.slug, n.title, n.lede, n.category, n.cover_url, n.cover_alt,
           n.reading_min, n.published_on,
           (coalesce(pc.poids, 0) = 3) as pour_moi,
           case when n.published_on >= current_date - 90
                then coalesce(pc.poids, 1) else 0 end as rang
      from news_articles n
      left join poids_cat pc on pc.categorie = n.category
     where n.status = 'publie' and n.published_on <= current_date
       and not n.portal_hidden
       and (n.portal_until is null or n.portal_until >= current_date)
  ),
  -- Le poids choisit TOUJOURS les cinq : c'est le ciblage par filière.
  retenus as (select * from tous order by rang desc, published_on desc, title
               limit least(greatest(coalesce(p_limit, 5), 1), 12)),
  sienne as (select * from tous
              where pour_moi and slug not in (select slug from retenus)
              order by published_on desc limit 1)
  select slug, title, lede, category, cover_url, cover_alt, reading_min,
         published_on, pour_moi
    from (select * from retenus union all select * from sienne) f
   -- … et la DATE décide de l'ordre de lecture.
   order by f.published_on desc, f.rang desc, f.title;
$fn$;
