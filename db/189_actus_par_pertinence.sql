-- 189 — Les actualités triées par pertinence, et non plus par date seule.
--
-- Demande du 20.10.2026, suite de db/188 : « un parent de kids tennis doit
-- d'abord voir Kids Tennis, Stages, Vie du club ». Jusqu'ici l'accueil rendait
-- les cinq dernières, point, avec un simple liseré sur celles de la filière.
--
-- LE CLASSEMENT, en trois poids.
--
--   3 — sa filière. Kids Tennis pour un kids tennis, Pro pour un pro.
--   2 — ce qui s'en approche : les stages et la GameZone pour les petits, le
--       Lausanne Open et les portraits de coachs pour les grands. « Vie du
--       club » vaut 2 pour tout le monde : c'est la maison commune.
--   1 — le reste. Visible, mais après. Rien n'est caché : tout ceci est
--       public, et masquer reviendrait à vider la section des familles dont
--       la filière n'a pas encore d'article.
--
-- Une famille peut avoir plusieurs filières (deux enfants, ou un enfant en
-- club ET en compétition) : on retient le poids le plus fort.
--
-- LE GARDE-FOU DES VIEUX ARTICLES. Un classement par pertinence seule fige la
-- tête de liste : l'article Kids Tennis de mars resterait devant la nouvelle
-- du jour, indéfiniment. Passé 90 jours, une actualité perd donc son poids et
-- retombe derrière tout ce qui est récent. La pertinence organise l'actualité,
-- elle ne la remplace pas.
--
-- La correspondance ci-dessous est le seul endroit à modifier quand une
-- catégorie naît sur le site ou qu'une filière change de nom.

begin;

create or replace function public.portal_site_news(p_youth uuid default null,
                                                   p_limit int default 5)
returns table(slug text, title text, lede text, category text, cover_url text,
              cover_alt text, reading_min smallint, published_on date,
              pour_moi boolean)
language sql stable security definer set search_path to 'public' as $$
  with cibles as (
    select pid from my_family_ids() as pid where p_youth is null
    union all
    select p_youth where p_youth is not null
                     and (can_read_public_of(p_youth) or portal_peut_apercevoir())
  ),
  cur as (select s.id from seasons s
           where s.kind = 'juniors' and current_date between s.start_date and s.end_date
           limit 1),
  -- Les filières de la famille : la saison en cours pour role_periods (source
  -- de vérité annuelle), et person_roles pour les étiquettes hors saison.
  mes_filieres as (
    select rp.role from role_periods rp
      join cibles c on c.pid = rp.person_id
      join cur on cur.id = rp.season_id
    union
    select pr.role from person_roles pr join cibles c on c.pid = pr.person_id
  ),
  -- Filière (base) -> catégorie (site) -> poids. « * » = pour tout le monde.
  -- Les deux vocabulaires resteront distincts : le site écrit pour des
  -- lecteurs, la base pour des requêtes. La charnière est ici, et ici seul.
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

    -- Adultes, cours privés, membres : pas de filière junior, donc pas de
    -- catégorie à eux. Le club et le tournoi leur parlent quand même.
    ('adultes',      'Club',          2),
    ('adultes',      'Lausanne Open', 2),
    ('prive',        'Club',          2),
    ('membre',       'Club',          2),
    ('membre',       'Lausanne Open', 2)
  ),
  -- Le poids retenu par catégorie : le plus fort de toutes ses filières.
  -- Les règles « * » s'appliquent même à une famille sans filière connue,
  -- d'où le filtre plutôt qu'une jointure.
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
           -- Le rang : le poids de la catégorie, sauf passé 90 jours.
           case when n.published_on >= current_date - 90
                then coalesce(pc.poids, 1) else 0 end as rang
      from news_articles n
      left join poids_cat pc on pc.categorie = n.category
     where n.status = 'publie' and n.published_on <= current_date
  ),
  retenus as (select * from tous order by rang desc, published_on desc, title
               limit least(greatest(coalesce(p_limit, 5), 1), 12)),
  -- Le rattrapage : si rien de sa filière n'est sorti (parce que le seul
  -- article qui la concerne a plus de 90 jours), on l'ajoute tout de même,
  -- en queue de liste puisque son rang est nul.
  sienne as (select * from tous
              where pour_moi and slug not in (select slug from retenus)
              order by published_on desc limit 1)
  select slug, title, lede, category, cover_url, cover_alt, reading_min,
         published_on, pour_moi
    from (select * from retenus union all select * from sienne) f
   order by f.rang desc, f.published_on desc, f.title;
$$;

comment on function public.portal_site_news(uuid, int) is
  'Actualités de teamlausanne.ch pour Mon espace, classées par pertinence pour les filières de la famille (db/189).';

revoke all on function public.portal_site_news(uuid, int) from public, anon;
grant execute on function public.portal_site_news(uuid, int) to authenticated;

commit;
