-- 133 — « Sur facture » : pouvoir dire qu'on a payé.
--
-- Constat de Raphael le 05.10.2026 : Rémi Moha a envoyé sa facture, elle a été
-- payée, et rien dans l'onglet Heures ne permettait de le noter. Il avait
-- raison, et le trou était plus large que le bouton manquant.
--
-- L'encadré « Sur facture » affichait trois états — à demander, demandée le…,
-- facture reçue — mais `coach_invoice_requests.received_at` et `invoice_id`
-- n'étaient **écrits nulle part** dans le code : seul `sent_at` l'était, à
-- l'envoi de la demande. « Facture reçue » ne pouvait donc jamais s'afficher,
-- et « payée » n'existait pas du tout. Le schéma prévoyait la suite, le
-- câblage n'a jamais été fait. La table était vide, d'ailleurs : Rémi a
-- envoyé sa facture de lui-même, sans qu'on la lui demande.
--
-- Le paiement lui-même est déjà suivi correctement ailleurs : une facture
-- reçue vit dans `invoices` (à valider → validée → en paiement → payée, avec
-- paid_at). On ne duplique donc pas cet état — l'encadré lira celui de la
-- facture liée.
--
-- Mais il faut un `paid_at` ici malgré tout, pour le cas courant où la
-- facture n'a pas été captée par le scan des mails (reçue sur papier, par
-- WhatsApp, en main propre). Sans ça, « marquer payé » ne marcherait que pour
-- les factures arrivées par e-mail — soit refuser de noter un paiement réel
-- parce que le PDF a pris un autre chemin.
--
-- Règle d'affichage côté console : payé si `paid_at` est posé OU si la
-- facture liée est à « payee ». Marquer payé pose les deux quand une facture
-- est liée, pour qu'ils ne divergent pas.

begin;

alter table coach_invoice_requests
  add column if not exists paid_at timestamptz,
  add column if not exists paid_by uuid references auth.users(id);

comment on column coach_invoice_requests.paid_at is
  'Paiement du coach indépendant. Posé aussi quand la facture liée passe « payee » ; sert seul quand aucune facture n''a été captée par le scan des mails.';

commit;

-- ---------------------------------------------------------------------------
-- Rémi Moha, septembre 2026 : rattrapage du cas qui a révélé le trou.
--
-- Sa facture est arrivée par mail le 01.10.2026 (« Facture kids septembre
-- 2026 », remimoha@gmail.com) et dormait dans « Reçues — à payer » à
-- « à valider », sans créancier ni montant. Montant repris de ses heures
-- validées de septembre : 18.75 h × 50.–/h = 937.50 (20 cours sur 20).
--
-- ⚠️ Le PDF n'a pas pu être relu d'ici : si Rémi a facturé un autre montant,
-- c'est à corriger dans Factures › Reçues — à payer.

begin;

update invoices
   set creditor_name = coalesce(creditor_name, 'Rémi Moha'),
       amount        = coalesce(amount, 937.50),
       explanation   = coalesce(explanation, '') || ' — heures de septembre 2026 : 18.75 h × 50.–',
       status        = 'payee',
       paid_at       = coalesce(paid_at, now())
 where id = '425b8019-62af-459a-a832-9d388fb65455'
   and status <> 'payee';

insert into coach_invoice_requests
  (person_id, ym, hours, rate, amount, invoice_id, received_at, paid_at, note, updated_at)
values
  ('bdf83183-cac8-46df-8810-ba2c43b0fa04', '2026-09', 18.75, 50, 937.50,
   '425b8019-62af-459a-a832-9d388fb65455',
   '2026-10-01 08:39:39+00',   -- arrivée réelle du mail
   now(),
   'Facture envoyée spontanément, sans demande préalable. Rattachée et payée au rapprochement du 05.10.2026.',
   now())
on conflict (person_id, ym) do update
   set invoice_id  = excluded.invoice_id,
       received_at = coalesce(coach_invoice_requests.received_at, excluded.received_at),
       paid_at     = coalesce(coach_invoice_requests.paid_at, excluded.paid_at),
       hours       = excluded.hours,
       rate        = excluded.rate,
       amount      = excluded.amount,
       updated_at  = now();

commit;
