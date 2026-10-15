-- Actualités : le journal du club (15.10.2026).
--
-- Objectif annoncé : un article par semaine, à partager sur les réseaux. Donc
-- une table, pas du contenu écrit en dur : à raison d'un article par semaine,
-- `site/contenu.js` demanderait une modification de code chaque lundi — et
-- Raphael ne doit pas avoir besoin d'un développeur pour publier une brève.
--
-- LE CORPS EST STOCKÉ EN BLOCS, pas en HTML. C'est déjà la règle du site
-- (voir CLAUDE.md : le contenu s'écrit en DONNÉES). Un corps en HTML serait
-- une porte ouverte à l'injection, impossible à rendre ailleurs qu'en page
-- web, et pénible à relire. Chaque bloc est un objet :
--
--   {"t":"p","x":"Un paragraphe."}
--   {"t":"h2","x":"Un intertitre"}
--   {"t":"quote","x":"Une citation.","src":"Qui l'a dite"}
--   {"t":"img","x":"https://…","alt":"Description","cap":"Légende"}
--
-- La console compose ces blocs à partir d'un texte simple ; le site les rend.
-- Ajouter un type de bloc plus tard ne casse rien : un bloc inconnu est ignoré
-- à l'affichage plutôt que de faire tomber la page.

create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  -- L'adresse publique : /actualites/<slug>. Unique, donc partageable et stable.
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) between 3 and 200),
  lede text,
  body jsonb not null default '[]'::jsonb,
  -- La filière concernée : c'est elle qui alimente les filtres de la page.
  category text not null default 'Vie du club',
  cover_url text,
  cover_alt text,
  reading_min smallint check (reading_min is null or reading_min between 1 and 60),
  author text not null default 'Team Lausanne Academy',
  -- Brouillon tant qu'on écrit ; publié quand ça peut être lu du public.
  status text not null default 'brouillon' check (status in ('brouillon', 'publie')),
  -- La date affichée, choisie par l'auteur : on antidate volontiers un article
  -- écrit après coup. Distincte de created_at, qui est l'horodatage technique.
  published_on date,
  -- Un seul article « à la une » à la fois : l'index partiel l'impose en base
  -- plutôt que de compter sur la discipline de qui publie.
  featured boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_publie_a_une_date check (status <> 'publie' or published_on is not null)
);
create unique index if not exists news_une_seule_une on public.news_articles (featured) where featured;
create index if not exists news_publies_idx on public.news_articles (status, published_on desc);
create index if not exists news_cat_idx on public.news_articles (category);

alter table public.news_articles enable row level security;

-- Le staff écrit. Personne d'autre, pas même en lecture : un brouillon ne
-- regarde que l'académie.
drop policy if exists news_staff on public.news_articles;
create policy news_staff on public.news_articles for all
  using (is_staff(auth.uid())) with check (is_staff(auth.uid()));

grant select, insert, update, delete on public.news_articles to authenticated;

-- La lecture publique passe par une FONCTION, jamais par une policy ouverte à
-- anon : la fonction ne rend que les colonnes publiques des articles publiés,
-- et ne peut pas laisser filtrer un brouillon, l'auteur interne ou les dates
-- techniques, même si la table gagne des colonnes plus tard.
create or replace function public.news_public(p_slug text default null)
returns table(slug text, title text, lede text, body jsonb, category text,
              cover_url text, cover_alt text, reading_min smallint,
              author text, published_on date, featured boolean)
language sql stable security definer set search_path to 'public' as $function$
  select n.slug, n.title, n.lede, n.body, n.category, n.cover_url, n.cover_alt,
         n.reading_min, n.author, n.published_on, n.featured
  from news_articles n
  where n.status = 'publie'
    and n.published_on <= current_date          -- rien ne paraît avant l'heure
    and (p_slug is null or n.slug = p_slug)
  order by n.featured desc, n.published_on desc, n.title;
$function$;

revoke all on function public.news_public(text) from public;
grant execute on function public.news_public(text) to anon, authenticated;

-- updated_at suit les modifications, sans y penser.
create or replace function public.news_touch() returns trigger
language plpgsql as $function$
begin new.updated_at := now(); return new; end $function$;
drop trigger if exists news_touch_trg on public.news_articles;
create trigger news_touch_trg before update on public.news_articles
  for each row execute function public.news_touch();
