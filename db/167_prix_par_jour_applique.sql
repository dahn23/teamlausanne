-- ===================================================================
--  FACTURES › le prix par jour, enfin APPLIQUÉ (point 6 de la liste)
-- ===================================================================
-- La grille par jour du produit Club existe depuis db/161 : lundi 770, mardi
-- 815, mercredi 815, jeudi 790, vendredi 770. Elle se saisit dans Factures ›
-- Produits, elle s'affiche dans la liste des produits… et RIEN ne la lisait au
-- moment de facturer. Le lot par filière prenait le contrat, sinon le tarif
-- plat de la grille Tarifs. Autrement dit : une saisie sans effet, et cinq prix
-- différents qui ne sortaient jamais.
--
-- Pour appliquer un prix « selon le jour », il faut savoir quel jour l'enfant
-- s'entraîne. Personne ne le saisit, et c'est tant mieux : le planning le sait
-- déjà. On le lit donc dans les cours du type lié au produit.
--
-- ⚠️ LE CAS QUI INTERDIT DE DEVINER. Sur 73 enfants en Club, 68 ont un seul
-- jour — mais quatre s'entraînent DEUX fois par semaine (jeudi ET lundi, mardi
-- ET jeudi). Leur prix n'est pas « celui du jeudi » : c'est une autre
-- situation, que le secrétariat seul peut trancher. Prendre le jour dominant
-- en silence les sous-facturerait de plusieurs centaines de francs chacun.
-- La fonction renvoie donc `ambigu` et NOMME les jours ; l'écran de lot
-- affiche l'avertissement et laisse le montant à décider.
--
-- Un jour isolé n'est pas un deuxième entraînement : Anaïs a six jeudis et un
-- mardi, ce mardi-là est un rattrapage. Le seuil (40 % du jour dominant, au
-- moins deux fois) sépare le rattrapage de l'habitude sans avoir à le saisir.

create or replace function public.product_weekday_prices(p_product uuid, p_from date)
returns table(person_id uuid, jour int, prix numeric, jours text, ambigu boolean)
language sql stable security definer set search_path = public as $$
  with prod as (
    select ip.id, ip.course_type_id, ip.price, ip.price_by_weekday
      from invoice_products ip where ip.id = p_product
  ),
  -- Combien de fois chaque enfant est passé, quel jour, dans les cours du type
  -- lié au produit. C'est le planning qui répond, pas une saisie de plus.
  vus as (
    select cp.child_person_id as pid,
           extract(isodow from c.course_date)::int as jour,
           count(*)::int as n
      from courses c
      join prod on prod.course_type_id = c.course_type_id
      join course_participants cp on cp.course_id = c.id
     where c.course_date >= p_from
     group by 1, 2
  ),
  dominant as (
    select pid, max(n) as nmax from vus group by pid
  ),
  -- Les jours RÉGULIERS : au moins 40 % du jour dominant, et au moins deux
  -- fois. En dessous, c'est un rattrapage.
  reguliers as (
    select v.pid, v.jour, v.n
      from vus v join dominant d on d.pid = v.pid
     where v.n >= greatest(2, ceil(d.nmax * 0.4))
  ),
  choix as (
    select r.pid,
           (array_agg(r.jour order by r.n desc, r.jour))[1] as jour_dominant,
           count(*)::int as nb_jours,
           string_agg(('{dim,lun,mar,mer,jeu,ven,sam,dim}'::text[])[r.jour + 1],
                      ', ' order by r.n desc, r.jour) as libelle
      from reguliers r group by r.pid
  )
  select c.pid,
         c.jour_dominant,
         coalesce((select (p.price_by_weekday ->> c.jour_dominant::text)::numeric from prod p),
                  (select p.price from prod p)) as prix,
         c.libelle,
         c.nb_jours > 1
    from choix c;
$$;

revoke all on function public.product_weekday_prices(uuid, date) from public, anon;
grant execute on function public.product_weekday_prices(uuid, date) to authenticated;

comment on function public.product_weekday_prices(uuid, date) is
  'Prix du produit selon le jour où la personne s''entraîne réellement (lu dans le planning). ambigu = plusieurs jours réguliers : le montant doit être tranché à la main.';
