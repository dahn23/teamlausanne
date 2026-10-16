-- ===================================================================
--  Locataires : les noms sous lesquels on les écrit dans le planning
-- ===================================================================
-- Le planning d'hiver est un document de travail : on y écrit le nom de la
-- personne qu'on a au téléphone, pas la raison sociale du locataire.
-- « Pellaz -150 de crédit » désigne en réalité TC Boisy — ce que seul Dan
-- pouvait dire, et qu'aucun rapprochement automatique n'aurait trouvé.
--
-- Deux façons de régler ça. Réécrire la case du planning — mais c'est le
-- document du secrétariat, et « Pellaz » y est l'information utile pour qui
-- lit la grille. Ou dire une fois pour toutes, sur la fiche du locataire,
-- sous quels autres noms on l'écrit. C'est la deuxième : la grille garde ses
-- mots, la facturation sait à qui les rattacher, et le prochain surnom se
-- règle par une ligne dans la fiche au lieu d'un correctif dans le code.
alter table court_tenants add column if not exists aliases text[];

comment on column court_tenants.aliases is
  'Autres noms sous lesquels ce locataire apparaît dans le planning d''hiver (winter_plan.player_name).';

update court_tenants
   set aliases = array['Pellaz']
 where name = 'TC Boisy'
   and (aliases is null or not ('Pellaz' = any(aliases)));

-- Le rapprochement nom ↔ fiche, alias compris. Sorti dans sa propre fonction :
-- le même test était écrit trois fois dans winter_rentals_from_plan, et trois
-- copies d'une règle finissent par diverger.
create or replace function public.wp_meme_locataire(p_libelle text, p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from court_tenants t
      cross join lateral unnest(array[t.name] || coalesce(t.aliases, '{}')) as n(nom)
     where t.id = p_tenant
       and (
         wp_nom_norme(n.nom) = wp_nom_norme(p_libelle)
         or (select bool_and(w = any(string_to_array(wp_nom_norme(n.nom), ' ')))
               from unnest(string_to_array(wp_nom_norme(p_libelle), ' ')) w where w <> '')
         or (select bool_and(w = any(string_to_array(wp_nom_norme(p_libelle), ' ')))
               from unnest(string_to_array(wp_nom_norme(n.nom), ' ')) w where w <> '')
       ));
$$;
revoke all on function public.wp_meme_locataire(text, uuid) from public, anon;
grant execute on function public.wp_meme_locataire(text, uuid) to authenticated;

-- winter_rentals_from_plan() passe désormais par wp_meme_locataire() pour le
-- rapprochement — définition complète appliquée en base le 16.10.2026, voir
-- db/178 pour le corps de la fonction.

-- L'ajustement de TC Boisy, posé après la régénération.
update tenant_rentals tr
   set ajustement_chf = -150,
       ajustement_motif = 'Crédit convenu, noté dans le planning d''hiver (« Pellaz -150 de crédit »)',
       amount_chf = tr.amount_chf - 150
  from court_tenants t
 where t.id = tr.tenant_id and t.name = 'TC Boisy'
   and tr.season_label = '2026/27'
   and tr.ajustement_chf is null;
