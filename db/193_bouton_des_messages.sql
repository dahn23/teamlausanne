-- 193 — Un bouton au bas d'un message interne, plutôt qu'une adresse en clair.
--
-- Demande du 20.10.2026, en travaillant l'accueil des compétiteurs : le
-- message GameZone finissait par « Toutes les dates et les infos :
-- https://teamlausanne.ch/#gamezone ». Le lien marchait — newsLinks() rend
-- cliquable toute adresse https:// d'un message — mais une adresse brute avec
-- un dièse au milieu, ça ne se touche pas, ça se déchiffre.
--
-- Deux colonnes suffisent : l'adresse, et le texte du bouton. Vides, rien ne
-- s'affiche et les anciens messages ne bougent pas. Le texte du message n'a
-- plus à porter l'adresse.
--
-- Pourquoi pas plusieurs boutons : un message interne appelle UNE action.
-- Deux boutons, c'est déjà un menu, et on écrirait alors une table pour les
-- tenir. Le jour où le besoin existe, elle se fera ; pas avant.

begin;

alter table news add column if not exists link_url text;
alter table news add column if not exists link_label text;

comment on column news.link_url is
  'Adresse du bouton affiché au bas du message dans Mon espace. Vide = pas de bouton.';
comment on column news.link_label is
  'Texte du bouton (défaut : « En savoir plus »).';

-- portal_news rend le message tel qu'il est lu par les familles : il lui faut
-- donc les deux nouvelles colonnes. Le reste de la fonction ne bouge pas —
-- mêmes audiences, même saison, même tri.
create or replace function public.portal_news()
returns table(id uuid, title text, body text, image_url text,
              link_url text, link_label text, published_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with mine as (select * from my_family_ids() as pid),
  cur as (select s.id from seasons s
           where s.kind = 'juniors' and current_date between s.start_date and s.end_date limit 1)
  select n.id, n.title, n.body, n.image_url, n.link_url, n.link_label,
         coalesce(n.published_at, n.created_at)
  from news n
  where n.published = true
    and (n.season_id is null or n.season_id = (select id from cur))
    and ( coalesce(array_length(n.audiences, 1), 0) = 0
          or exists (select 1 from role_periods rp join mine on rp.person_id = mine.pid
                     where rp.season_id = coalesce(n.season_id, (select id from cur))
                       and rp.role = any(n.audiences))
          or exists (select 1 from person_roles pr join mine on pr.person_id = mine.pid
                     where pr.role = any(n.audiences)) )
  order by coalesce(n.published_at, n.created_at) desc;
$$;

commit;
