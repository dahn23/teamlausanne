-- Rectification des statuts de factures : Kids Tennis et Compétition (09.10.2026).
--
-- Demande du secrétariat. Rien n'a été envoyé ni encaissé par la plateforme :
-- ces factures sont passées par l'ancien circuit, et on remet simplement la
-- base d'accord avec la réalité.
--
-- Les familles ont été données par NOM. Deux lectures possibles quand une
-- famille a plusieurs enfants ; on a retenu « le nom = la famille », parce que
-- dans la même liste le secrétariat a écrit « Maeva Gomez » et « Noemie Rose »,
-- c'est-à-dire un prénom précisément là où le nom seul aurait été ambigu
-- (Gomez Maeva / Gomez Melim ; Tchouaket Happi Noemie Rose / Enzo). Un nom nu
-- vaut donc pour toute la fratrie — et de fait chaque paire ci-dessous partage
-- un seul débiteur, donc un seul versement.
--
-- On pose paid_at mais PAS sent_at sur les « payées » : on sait qu'elles sont
-- encaissées, on ne sait pas que la plateforme les a envoyées. Mieux vaut un
-- champ vide qu'une date inventée.
--
-- Deux noms de la demande n'ont PAS été traités, faute de correspondance dans
-- la filière annoncée — laissés en l'état, en attente d'une réponse :
--   · Enzo Tchouaket Happi : aucune facture Kids Tennis, seulement Club
--     2026-0265 (815.–) ;
--   · Dietvorst : aucune facture Compétition, seulement Club 2026-0220 et
--     2026-0221 (Adriaan et Arthur, 815.– chacun).

-- 1. Kids Tennis — encaissées (20 factures, 9 800.–)
update out_invoices set status = 'payee', paid_at = now()
 where filiere = 'kidstennis' and status = 'a_envoyer'
   and number in (
     '2026-0125',  -- Allauca Steeve
     '2026-0127',  -- Betiel Amanuel
     '2026-0128',  -- Bettahar Leila
     '2026-0135',  -- Cobuccio Ilyas
     '2026-0139',  -- Damasio Logan
     '2026-0143',  -- El Sayed Dany          \ même débiteur
     '2026-0144',  -- El Sayed Rayan Ali     /
     '2026-0150',  -- Gomez Maeva
     '2026-0156',  -- Hesslein Analia        \ même famille
     '2026-0157',  -- Hesslein Valerian      /
     '2026-0165',  -- Jullien-Kaeppelin Axelle
     '2026-0167',  -- Korsik Zoia
     '2026-0168',  -- Kostadinovic Léa
     '2026-0169',  -- Krieger Léandre
     '2026-0174',  -- Marques Bah Diaraye
     '2026-0177',  -- Mederreg Melissa
     '2026-0178',  -- Medina Chloé           \ même débiteur
     '2026-0179',  -- Medina Léa             /
     '2026-0183',  -- Mijatovic Mila
     '2026-0209'); -- Tchouaket Happi Noemie Rose

-- 2. Kids Tennis — annulées (2 factures)
update out_invoices set status = 'annulee'
 where filiere = 'kidstennis' and status = 'a_envoyer'
   and number in (
     '2026-0124',  -- Abbet Marine
     '2026-0142'); -- Dumas Lila

-- 3. Compétition — envoyées (5 factures, 9 950.–)
--    « Envoyée » et pas « payée » : le secrétariat a intitulé la liste
--    « Invoice Sent ». Des versements sont arrivés, en entier ou en partie,
--    mais la table n'a pas d'état « partiellement payée » — une facture reste
--    envoyée jusqu'à son solde. Le rapprochement bancaire fera le reste.
update out_invoices set status = 'envoyee', sent_at = now()
 where filiere = 'competition' and status = 'a_envoyer'
   and number in (
     '2026-0276',  -- Ayer Julian
     '2026-0277',  -- Baudin Clément
     '2026-0282',  -- Danko Nathaniel
     '2026-0290',  -- Moreira Zordan Enzo
     '2026-0291'); -- Mortezavi Mani

-- 4. Compétition — annulée (1 facture)
update out_invoices set status = 'annulee'
 where filiere = 'competition' and status = 'a_envoyer'
   and number = '2026-0293';  -- Ouertatani Eya

-- Vérifié après coup :
--   Kids Tennis   51 à envoyer → 29 · 37 annulées → 39 · 20 payées (9 800.–)
--   Compétition   16 à envoyer → 10 ·  6 annulées →  7 ·  5 envoyées (9 950.–)

-- ---------------------------------------------------------------------------
-- 5. Les deux noms en suspens, tranchés par le secrétariat le 09.10.2026.
--    Les factures existaient bien, mais en CLUB et non dans la filière
--    annoncée. Confirmation obtenue avant de toucher quoi que ce soit : 2 445.–
--    annulés, ce n'est pas le genre de raccourci qu'on prend tout seul.
update out_invoices set status = 'annulee'
 where filiere = 'club' and status = 'a_envoyer'
   and number in (
     '2026-0265',  -- Tchouaket Happi Enzo   (815.–) — annoncé en Kids Tennis
     '2026-0220',  -- Dietvorst Adriaan      (815.–) \ annoncés en Compétition
     '2026-0221'); -- Dietvorst Arthur       (815.–) /

-- Note : Ayer et Mortezavi ont reçu un acompte. Rien ne l'enregistre — la table
-- n'a pas d'état « partiellement payée », et la colonne `note` n'est affichée
-- nulle part dans la console. Les deux restent « envoyée », et c'est le
-- rapprochement bancaire qui portera le solde quand les montants seront connus.
