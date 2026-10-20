-- 195 — Un logo posé sur l'image d'un message, et la date retirée des cartes.
--
-- Demande du 20.10.2026 : « enlève la date 28.09, elle ne sert à rien » et
-- « mets le logo GameZone sur l'image, je veux qu'on le voie plus souvent ».
--
-- LA DATE. Ces messages ne sont pas des nouvelles : « Bienvenue en
-- Compétition » et « Inscris-toi aux GameZone » valent toute la saison. Les
-- dater les faisait vieillir pour rien — une invitation marquée du 28.09 a
-- l'air périmée en janvier, alors qu'elle est toujours vraie. Le retrait est
-- dans espace.js, pas ici ; la colonne published_at reste, elle sert au tri.
--
-- LE LOGO. Une colonne logo_url, rendue en pastille blanche au coin haut
-- gauche de l'image. Blanche parce que le logo GameZone est bleu : posé à même
-- une photo claire, il disparaîtrait. Vide, aucune pastille.
--
-- Pourquoi une colonne plutôt qu'une règle « si la catégorie est GameZone
-- alors ce logo » : demain ce sera le Lausanne Open, ou le logo d'un
-- partenaire. Une adresse dans un champ se change sans toucher au code.

begin;

alter table news add column if not exists logo_url text;

comment on column news.logo_url is
  'Logo posé en pastille sur l''image du message (coin haut-gauche). Vide = pas de logo.';

create or replace function public.portal_news()
returns table(id uuid, title text, body text, image_url text, logo_url text,
              link_url text, link_label text, published_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with mine as (select * from my_family_ids() as pid),
  cur as (select s.id from seasons s
           where s.kind = 'juniors' and current_date between s.start_date and s.end_date limit 1)
  select n.id, n.title, n.body, n.image_url, n.logo_url, n.link_url, n.link_label,
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

-- Le message GameZone porte le logo GameZone.
update news set logo_url = 'https://teamlausanne.ch/assets/logo-gamezone-blanc.png'
 where id = 'a3259103-0ba1-481a-b705-8c9cc7d92ae7';

commit;
