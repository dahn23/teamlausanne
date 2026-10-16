-- ===========================================================================
--  162 — Le produit facturé correspond-il au cours de l'enfant ?
-- ---------------------------------------------------------------------------
--  Point 2 de la liste de l'équipe. On ne bloque pas la CRÉATION — il y a de
--  bonnes raisons de facturer autre chose que le cours suivi (rattrapage, cas
--  particulier, changement en cours de saison) — mais on le signale, et
--  l'envoi s'en sert pour refuser de partir sur un doute.
--
--  Trois réponses possibles, et « null » n'est pas « faux » :
--    true  : le produit correspond à un cours où l'enfant est inscrit
--    false : il est inscrit à des cours, mais pas à celui-là  → à vérifier
--    null  : rien à vérifier (facture sans joueur, produit sans cours lié, ou
--            enfant inscrit à aucun cours). Traiter null comme une erreur
--            noierait le vrai signal sous des faux positifs : à la mise en
--            place, 140 factures sur 317 sont dans ce cas.
--
--  Mesuré à la création : 167 cohérentes, 10 à vérifier, 140 sans objet. Deux
--  des dix n'étaient pas encore envoyées — ce sont exactement celles que ce
--  garde-fou existe pour retenir.
-- ===========================================================================
create or replace view out_invoices_coherence as
select
  f.id,
  f.person_id,
  p.name            as produit,
  p.course_type_id  as produit_cours,
  (select string_agg(distinct ct.name, ', ' order by ct.name)
     from course_participants cp
     join courses c       on c.id  = cp.course_id
     join course_types ct on ct.id = c.course_type_id
    where cp.child_person_id = f.person_id)              as cours_inscrits,
  case
    when f.person_id is null        then null
    when p.course_type_id is null   then null
    when not exists (select 1 from course_participants cp where cp.child_person_id = f.person_id) then null
    when exists (
      select 1 from course_participants cp
        join courses c on c.id = cp.course_id
       where cp.child_person_id = f.person_id
         and c.course_type_id = p.course_type_id)        then true
    else false
  end                                                     as coherent
from out_invoices f
left join invoice_products p on p.id = f.product_id;
