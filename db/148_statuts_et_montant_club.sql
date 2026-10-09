-- Factures Club : relances, annulation, encaissement, et un montant corrigé
-- (09.10.2026, suite de db/147).
--
-- Même contexte : ces factures sont parties par l'ancien circuit. On remet la
-- base d'accord avec la réalité, on n'envoie rien.
--
-- Sur « en attente de relance » : la table n'a pas cet état. Une facture à
-- relancer, dans la console, c'est `envoyee` dont la `due_date` est passée
-- (admin.js, vue des retards). Les 23 ci-dessous échoient le 31.10.2026 : elles
-- s'affichent donc « envoyée » aujourd'hui et basculeront d'elles-mêmes dans
-- les retards le 1er novembre. C'est l'état juste, pas un contournement.

-- 1. Envoyées — en attente de paiement, puis de relance (23 factures)
--    Un nom nu vaut pour la fratrie (même règle qu'en db/147) : les Zardini,
--    les Lauber et les Jullien-Kaeppelin partagent chacun un seul débiteur.
update out_invoices set status = 'envoyee', sent_at = now()
 where filiere = 'club' and status = 'a_envoyer'
   and number in (
     '2026-0216',  -- Bouzerna Jade
     '2026-0218',  -- Dallais Achille
     '2026-0224',  -- Ferry Benoît
     '2026-0225',  -- Gossweiler Ava
     '2026-0226',  -- Greuter Léonard
     '2026-0231',  -- Jullien-Kaeppelin Capucine  \ même débiteur
     '2026-0232',  -- Jullien-Kaeppelin Paul      /
     '2026-0234',  -- Kolb Arnaud
     '2026-0236',  -- Lauber Emil                 \ même débiteur
     '2026-0237',  -- Lauber Oscar                /
     '2026-0241',  -- Moreau Mourot Charlie
     '2026-0244',  -- Özalp Mücahit
     '2026-0246',  -- Peña Oliver Julia
     '2026-0252',  -- Roch Léonie
     '2026-0253',  -- Rossetti Francesco (Club ; sa facture de stage 2026-0318 n'est pas concernée)
     '2026-0255',  -- Ruf Roméo
     '2026-0259',  -- Sevel Axel
     '2026-0261',  -- Sohrabi Nami
     '2026-0262',  -- Stanovici Gaspard
     '2026-0268',  -- Uhlmann Robin      (fiche « Uhlmann », débiteur « Uhlman »)
     '2026-0272',  -- Wimmersperger Anaïs (fiche « Wimmersperger », débiteur « Wimmersberger »)
     '2026-0273',  -- Zardini Juliette            \ même débiteur
     '2026-0274'); -- Zardini Matteo              /

-- 2. Annulée (1 facture)
update out_invoices set status = 'annulee'
 where filiere = 'club' and status = 'a_envoyer'
   and number = '2026-0240';  -- Mayor André
--    Dietvorst était déjà annulé en db/147 (2026-0220 et 2026-0221) : rien à faire.

-- 3. Encaissée (1 facture)
update out_invoices set status = 'payee', paid_at = now()
 where filiere = 'club' and status = 'a_envoyer'
   and number = '2026-0242';  -- Moreira Ivy
--    « Korsik » n'a rien d'ouvert : Zoia (Kids Tennis 2026-0167) est payée
--    depuis db/147, et Maria (Club 2026-0235) est annulée. Rien touché.

-- 4. Coraline Favre : 1 990.– → 770.–
--    La ligne d'article suit le total. Si on ne changeait que `amount`, le PDF
--    afficherait un détail à 1 990.– sous un total à 770.– — une facture qui se
--    contredit elle-même. La référence RF ne dépend pas du montant : inchangée.
update out_invoices
   set amount = 770,
       items  = jsonb_build_array(jsonb_build_object('label', items->0->>'label', 'amount', 770))
 where number = '2026-0287';  -- Compétition, Favre Coraline

-- En suspens : Bouzerna. Le secrétariat annonce une facture partiellement
-- payée (300.– de solde) et « une autre à 815.– ». Jade Bouzerna n'a qu'UNE
-- facture en base (2026-0216, Club, 815.–, désormais envoyée), et aucune autre
-- fiche Bouzerna n'existe. Rien inventé : question posée.

-- Bouzerna, tranché le 09.10.2026 : rien à corriger, finalement.
--   · Le solde de 300.– porte sur la saison 2025/26. La plateforme ne contient
--     que du 2026/27 (310 factures) : cette dette-là n'y a jamais eu de trace,
--     et il n'y a donc pas de seconde facture à retrouver.
--   · 2026-0216 (Club 2026/27, 815.–) est la NOUVELLE, impayée. Elle est passée
--     « envoyée » au point 1, ce qui est exactement son état.
-- Rien créé pour les 300.– : fabriquer une facture 2025/26 avec un numéro et
-- une référence de la série 2026/27 produirait une pièce comptable fausse.
