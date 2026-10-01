-- 125 — Facturation de Loris Gander : le père plutôt que la mère.
--
-- Demande de Raphael : les factures de Loris doivent partir sur
-- sylvain.gander@gmail.com. Elles partaient jusqu'ici à Stéphanie Bauen
-- (bauenstephanie@bluewin.ch).
--
-- Pourquoi elles partaient là : oiDebtorCands() dans admin.js choisit le
-- débiteur dans cet ordre — parent lié ayant un e-mail, puis Parent 1, puis
-- Parent 2, puis le joueur. Loris n'a aucun lien de parenté enregistré, et
-- sa mère occupait le champ Parent 1. Intervertir les deux parents suffit
-- donc à ce que les PROCHAINES factures partent au père, sans toucher au code.
--
-- La mère reste sur la fiche en Parent 2 : la demande portait sur la
-- facturation, pas sur ses coordonnées. Elle reste joignable.
--
-- Les onze factures Pro 2026/27 déjà créées sont reprises, y compris la
-- 2026-0019 déjà envoyée : si le dossier dit « Sylvain » et le PDF stocké
-- « Stéphanie », on se retrouve avec l'incohérence rencontrée sur la facture
-- Picci. pdf_path est donc vidé partout — oiAssurerPdf() refabrique le PDF au
-- prochain affichage ou envoi, avec le bon destinataire. Le numéro et la
-- référence RF ne bougent pas : un paiement fait sur l'ancien PDF se
-- rapproche toujours.

begin;

-- 1. Le père passe en Parent 1, la mère en Parent 2.
update people
   set parent1 = 'Sylvain Gander · 078 624 32 80 · sylvain.gander@gmail.com',
       parent2 = 'Stéphanie Bauen · 078 624 32 76 · bauenstephanie@bluewin.ch'
 where id = '4a182fff-0b34-42c2-a81a-1bcef0f59627';   -- Loris Gander

-- 2. Les factures existantes, PDF compris.
update out_invoices
   set debtor_name  = 'Sylvain Gander',
       debtor_email = 'sylvain.gander@gmail.com',
       pdf_path     = null,
       note = coalesce(note || E'\n', '')
           || 'Destinataire corrigé le 01.10.2026 : Sylvain Gander (père) '
           || 'remplace Stéphanie Bauen. PDF à refabriquer.'
 where person_id = '4a182fff-0b34-42c2-a81a-1bcef0f59627';

commit;

-- À faire à la main, hors SQL : la 2026-0019 (4 150.–) était déjà partie chez
-- Stéphanie le 24.09 et reste impayée. Si le père doit la recevoir, il faut la
-- renvoyer depuis la console — le PDF se refabriquera à son nom.
