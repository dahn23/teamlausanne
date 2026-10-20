-- 188 — Les actualités du site dans Mon espace.
--
-- Demande du 20.10.2026 : l'accueil de Mon espace ne montrait que les messages
-- internes (table « news », écrits depuis la console pour une filière et une
-- saison). Les articles publiés sur teamlausanne.ch, eux, ne sortaient jamais
-- du site public — alors que les familles sont déjà dans l'app.
--
-- On ne recopie rien : les articles restent dans news_articles, écrits une
-- seule fois pour le site. Cette fonction n'est qu'une seconde porte vers les
-- mêmes lignes, taillée pour un téléphone :
--
--   · sans le corps de l'article (jsonb parfois long) — la liste reste légère ;
--     pour lire, l'app redemande l'article seul à news_public(slug) ;
--   · avec un drapeau « pour_moi » : la catégorie de l'article correspond à une
--     filière de la famille. L'app peut ainsi distinguer « Kids Tennis » quand
--     on EST kids tennis, sans rien cacher du reste — tout ceci est public.
--
-- Pourquoi un drapeau plutôt qu'un filtre : il n'y a aujourd'hui aucun article
-- en Kids Tennis, Club, Performance ni Sport-études. Filtrer aurait laissé la
-- plupart des familles devant une section vide, c'est-à-dire pire que rien.
-- On montre donc les dernières actualités à tout le monde, en marquant celles
-- de sa filière, et on garantit qu'au moins une des siennes figure dans la
-- liste s'il en existe une (voir « sienne » plus bas).
--
-- p_youth : null = toute la famille (cas normal). Renseigné = ce jeune-là,
-- ce qui sert à l'aperçu de la console (db/187) : un admin qui regarde
-- l'espace d'un kids tennis doit voir les actualités d'un kids tennis, pas
-- celles de sa propre famille.

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
  -- Filière (base) -> catégorie (site). Les deux vocabulaires sont distincts
  -- et le resteront : le site écrit pour des lecteurs, la base pour des
  -- requêtes. La correspondance vit ici, en un seul endroit.
  corresp(role, categorie) as (values
    ('kidstennis',   'Kids Tennis'),
    ('club',         'Club'),
    ('competition',  'Compétition'),
    ('performance',  'Performance'),
    ('sport-etudes', 'Sport-études'),
    ('pro',          'Pro'),
    ('pro-u18',      'Pro')
  ),
  mes_cats as (select distinct k.categorie from corresp k
                join mes_filieres f on f.role = k.role),
  tous as (
    select n.slug, n.title, n.lede, n.category, n.cover_url, n.cover_alt,
           n.reading_min, n.published_on,
           (n.category in (select categorie from mes_cats)) as pour_moi
      from news_articles n
     where n.status = 'publie' and n.published_on <= current_date
  ),
  recents as (select * from tous order by published_on desc, title
               limit least(greatest(coalesce(p_limit, 5), 1), 12)),
  -- Le rattrapage : si aucune des dernières actualités ne concerne la filière
  -- de la famille, on ajoute la plus récente qui la concerne. Elle arrive en
  -- fin de liste puisqu'elle est, par construction, plus ancienne.
  sienne as (select * from tous
              where pour_moi and slug not in (select slug from recents)
              order by published_on desc limit 1)
  select * from recents
  union all
  select * from sienne
  order by published_on desc, title;
$$;

comment on function public.portal_site_news(uuid, int) is
  'Dernières actualités de teamlausanne.ch pour Mon espace, sans le corps, avec un drapeau « de ma filière ».';

revoke all on function public.portal_site_news(uuid, int) from public, anon;
grant execute on function public.portal_site_news(uuid, int) to authenticated;

commit;
