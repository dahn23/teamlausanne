-- ===================================================================
--  Locations de courts : les trois tarifs convenus (16.10.2026)
-- ===================================================================
-- Le planning d'hiver porte des prix griffonnés à même les cases. Dan les a
-- tranchés ; on les range ici, dans ajustement_chf et non dans le montant,
-- pour deux raisons.
--
-- D'abord ils survivent à une régénération : winter_rentals_from_plan()
-- remplace les lignes d'un locataire, et un montant corrigé à la main serait
-- écrasé par le tarif plein sans un mot.
--
-- Ensuite le tarif reste lisible à côté de l'écart. On peut répondre « 800,
-- ramené à 500 » plutôt que « 500, je ne sais plus pourquoi » — et c'est la
-- seule version qui tienne devant une famille qui demande pourquoi.
--
-- Romeo Franco ne figure pas ici : son « (Raiffeisen) » nommait le payeur,
-- pas un prix. Il reste au tarif, 1100.

update tenant_rentals tr
   set ajustement_chf   = 500 - tr.amount_chf,
       ajustement_motif = 'Tarif convenu : 500 (noté « Geerinckx (500) » au planning)',
       amount_chf       = 500
  from court_tenants t
 where t.id = tr.tenant_id and t.name = 'Mathilde Geerinckx'
   and tr.season_label = '2026/27' and tr.ajustement_chf is null;

update tenant_rentals tr
   set ajustement_chf   = 672 - tr.amount_chf,
       ajustement_motif = 'Tarif convenu : 672 (noté « 850-178=672 » au planning)',
       amount_chf       = 672
  from court_tenants t
 where t.id = tr.tenant_id and t.name = 'Nathalie Duboy Des Termes'
   and tr.season_label = '2026/27' and tr.ajustement_chf is null;

-- Résultat mesuré après une régénération complète : 41 créneaux,
-- 23 locataires, 74 100 au tarif, −703 d'ajustements, 73 397 à facturer,
-- et les trois ajustements bien reportés.
