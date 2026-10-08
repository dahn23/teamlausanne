-- 137 — Joël Grumelli : le repas de midi s'ajoute à sa facture de stage.
--
-- Demande de Raphael le 08.10.2026 : ajouter 100.— de repas à la facture du
-- stage d'automne de Joël Grumelli.
--
-- Sa catégorie — « Loisir matin », 290.— — ne comprend pas le repas
-- (stage_categories.meal = false) : le stage s'arrête à midi. Il mange sur
-- place quand même, d'où la ligne supplémentaire.
--
-- Facture 2026-0314, encore à « a_envoyer » : rien n'est parti chez la
-- famille, on peut donc la corriger au lieu d'en émettre une seconde. Le
-- numéro et la référence QR ne bougent pas.
--
--   290.—  stage, du 12 au 16.10.2026
--   100.—  repas de midi
--   ----
--   390.—
--
-- pdf_path repasse à NULL : la console régénère automatiquement le PDF
-- manquant d'une facture « à envoyer » à la prochaine ouverture de
-- Factures › Émises (admin.js, oiMakePdf). Le fichier stocké porte le même
-- nom et sera écrasé — sans ça, le PDF de 290.— serait resté joint au mail.

begin;

update out_invoices
   set amount = 390.00,
       label  = 'Stage Automne - Semaine 1 — Loisir matin + repas de midi',
       items  = items || jsonb_build_array(
                  jsonb_build_object('label', 'Repas de midi, du 12.10.2026 au 16.10.2026',
                                     'amount', 100)),
       pdf_path = null
 where id = '4f46737c-0b7b-4230-b3b0-8b611ee1b703'
   and status = 'a_envoyer';          -- garde-fou : ne rien toucher si elle est partie entre-temps

commit;
