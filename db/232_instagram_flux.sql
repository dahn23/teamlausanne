-- 232 — Flux Instagram du site public (06.11.2026)
--
-- Le bandeau « Le club, au jour le jour » montrait des photos du site, et le
-- pseudo affiche n'existait plus (cf. le commit qui remplace
-- @lausanne_sports_tennis par @team_lausanne_academy). Decision de Raphael :
-- de vraies publications, par l'API de Meta, sans service tiers — les photos
-- et le trafic du site restent chez nous.
--
-- Deux tables, et elles n'ont pas du tout le meme regime.

-- 1) LE JETON. Table a part, et surtout PAS app_settings : app_settings a une
-- policy de lecture « true » pour anon — un jeton y serait public, lisible par
-- n'importe qui avec la cle publiable. Ici : RLS activee, AUCUNE POLICY. Donc
-- personne ne lit, sauf la cle de service, qui ne passe pas par la RLS. Meme
-- recette que lo_secret (Lausanne Open).
create table if not exists public.insta_secret (
  id           int primary key default 1 check (id = 1),
  token        text not null,
  expires_at   timestamptz,          -- fin de validite connue du jeton long
  refreshed_at timestamptz,
  user_id      text,                 -- identifiant du compte Instagram, si connu
  updated_at   timestamptz not null default now()
);
alter table public.insta_secret enable row level security;
revoke all on public.insta_secret from anon, authenticated;

-- 2) LE CACHE. Lisible par tout le monde : ce sont des publications publiques.
-- Ecrit uniquement par la fonction edge (cle de service).
create table if not exists public.insta_posts (
  id            text primary key,         -- identifiant Meta du media
  permalink     text not null,
  media_type    text,                     -- IMAGE | VIDEO | CAROUSEL_ALBUM
  media_url     text,                     -- ⚠ URL du CDN Meta : elle EXPIRE
  thumbnail_url text,                     -- vignette, pour les videos
  caption       text,
  posted_at     timestamptz,
  fetched_at    timestamptz not null default now()
);
alter table public.insta_posts enable row level security;
drop policy if exists insta_posts_lire on public.insta_posts;
create policy insta_posts_lire on public.insta_posts for select to anon, authenticated using (true);

create index if not exists insta_posts_date on public.insta_posts (posted_at desc);

comment on table public.insta_posts is
  'Cache des publications Instagram. Les media_url du CDN Meta expirent en quelques jours : la fonction edge « instagram » les rafraichit.';

-- POSER LE JETON (a faire dans l'editeur SQL de Supabase, pas ici : le jeton
-- ne doit passer ni par un depot Git ni par une conversation).
--
--   insert into insta_secret (id, token, expires_at)
--   values (1, 'COLLER_LE_JETON_ICI', now() + interval '60 days')
--   on conflict (id) do update
--     set token = excluded.token, expires_at = excluded.expires_at, updated_at = now();
--
-- Ensuite la fonction edge le renouvelle toute seule quand il lui reste moins
-- de dix jours. Mode d'emploi complet : docs/instagram.md.
--
-- Pour verifier sans rien devoiler :
--   select id, expires_at, refreshed_at, length(token) as longueur from insta_secret;
--   select count(*), max(fetched_at) from insta_posts;
