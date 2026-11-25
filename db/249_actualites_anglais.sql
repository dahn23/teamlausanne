-- ===========================================================================
--  249 — Les actualités en anglais (25.11.2026)
-- ---------------------------------------------------------------------------
--  Appliqué en base. Ce fichier est la trace, pas un script à rejouer.
--
--  Le site public existe désormais en anglais sous /en. Les quatorze pages de
--  programme viennent de fichiers de données (site/contenu-en.js), traduits
--  une fois. Les actualités, elles, continuent d'arriver : elles vivent en
--  base, écrites depuis la console. Il leur faut donc leur propre version
--  anglaise, saisie au même endroit que la française.
--
--  QUATRE COLONNES, PAS UNE DE PLUS. Chaque champ supplémentaire est un champ
--  que quelqu'un doit remplir à chaque article : on s'en tient à ce qui se
--  lit. Le slug reste COMMUN aux deux langues (/actualites/x et /en/news/x) —
--  une adresse anglaise serait plus jolie, mais ce serait une cinquième
--  colonne à remplir et un doublon de plus à surveiller.
--
--  ⚠ Un article n'est « disponible en anglais » que si title_en ET body_en
--  sont renseignés, body_en étant un tableau non vide. Un titre sans corps ne
--  doit JAMAIS sortir : on afficherait une page anglaise au contenu français,
--  ce que toute cette traduction s'applique à éviter.
--
--  ⚠⚠ L'ANCIENNE SURCHARGE A DÛ ÊTRE RETIRÉE. news_public(text) et
--  news_public(text, text) se recouvrent : un appel sans argument ne savait
--  plus laquelle choisir (« function news_public() is not unique »), et
--  PostgREST, qui résout par nom de paramètre, tombait sur la même
--  ambiguïté. La nouvelle couvre entièrement l'ancienne grâce au défaut
--  p_lang = 'fr', donc les trois appelants existants — site/build.mjs,
--  site/index.js et espace.js — n'ont pas été touchés.
-- ===========================================================================

alter table public.news_articles
  add column if not exists title_en     text,
  add column if not exists lede_en      text,
  add column if not exists body_en      jsonb,
  add column if not exists cover_alt_en text;

comment on column public.news_articles.title_en is
  'Titre anglais. Avec body_en, decide si l''article parait sur /en/news.';
comment on column public.news_articles.body_en is
  'Corps anglais, meme forme que body. Vide = l''article reste francais seulement.';

drop function if exists public.news_public(text);

create or replace function public.news_public(
  p_slug text default null,
  p_lang text default 'fr'
)
returns table (
  slug text, title text, lede text, body jsonb, category text,
  cover_url text, cover_alt text, reading_min smallint, author text,
  published_on date, featured boolean
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select n.slug,
         case when p_lang = 'en' then n.title_en     else n.title     end,
         case when p_lang = 'en' then n.lede_en      else n.lede      end,
         case when p_lang = 'en' then n.body_en      else n.body      end,
         n.category,
         n.cover_url,
         case when p_lang = 'en' then coalesce(n.cover_alt_en, n.cover_alt) else n.cover_alt end,
         n.reading_min, n.author, n.published_on, n.featured
  from news_articles n
  where n.status = 'publie'
    and n.published_on <= current_date
    and (p_slug is null or n.slug = p_slug)
    and (p_lang <> 'en'
         or (coalesce(btrim(n.title_en), '') <> '' and n.body_en is not null
             and jsonb_typeof(n.body_en) = 'array' and jsonb_array_length(n.body_en) > 0))
  order by n.featured desc, n.published_on desc, n.title;
$$;

grant execute on function public.news_public(text, text) to anon, authenticated;
