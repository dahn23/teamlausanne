-- 143 — La facture qui manquait : Francesco Rossetti, Automne Semaine 2.
--
-- Suite de db/142. Une fois le doublon retiré, il restait un seul inscrit des
-- deux semaines d'automne sans facture : Francesco Rossetti, Loisir journée,
-- Semaine 2. C'est lui qui gardait la pastille Stages en rouge.
--
-- La facture est écrite ici à la main parce que le bouton « Créer la facture »
-- de la console fabrique aussi le PDF de la QR-facture, ce qui n'arrive que
-- dans le navigateur. On pose donc la ligne avec pdf_path à NULL : l'onglet
-- Factures régénère en arrière-plan tout PDF manquant d'une facture
-- « à envoyer » ou « envoyée » (oiMakePdf au chargement), et l'envoi le
-- fabrique de toute façon à la demande. Même procédé que db/137.
--
-- Les montants et le libellé recopient à l'identique les quatre factures
-- Loisir journée de la Semaine 1 (2026-0303 à 2026-0306) : 450.— pour une
-- semaine de cinq jours, un seul article, pas de rabais ni d'option privé
-- pour lui.
--
-- Échéance : la règle de la console est « 5 jours avant le début du stage,
-- mais jamais moins de 10 jours après l'émission ». Début le 19.10 → 14.10 ;
-- émise le 08.10 → 18.10 au plus tôt. C'est donc le 18.10.2026.
--
-- Référence : ISO 11649 (SCOR). Les deux chiffres de contrôle sont ceux qui
-- rendent « base + RF + 00 » congru à 1 modulo 97, avec R=27 et F=15. Formule
-- vérifiée contre les dix références déjà en base avant de s'en servir.
--
-- created_by reste NULL : aucune session utilisateur n'écrit cette ligne, et
-- mentir sur l'auteur serait pire que de ne rien mettre.

begin;

with v as (
  select '2026-0318'::text as num,
         date '2026-10-08' as emission,
         date '2026-10-18' as echeance,
         450::numeric      as montant
),
ins as (
  insert into public.out_invoices (
    number, reference, filiere, season_id,
    person_id, debtor_person_id, debtor_name, debtor_email,
    debtor_street, debtor_zip, debtor_city,
    items, amount, label, currency,
    issue_date, due_date, account_id, status, pdf_path, created_by)
  select
    v.num,
    'RF' || lpad((98 - ((regexp_replace(v.num,'\D','','g') || '2715' || '00')::numeric % 97))::text, 2, '0')
         || regexp_replace(v.num,'\D','','g'),
    'stage', 'dcae97a4-2877-428e-b19c-9fb5797d4b89',
    'b0b70361-e3c7-4e5d-8d6d-4be17e6081fa', 'b0b70361-e3c7-4e5d-8d6d-4be17e6081fa',
    'Francesco Rossetti', 'marko.rossetti@gmail.com',
    'Chemin du Frêne 11', '1004', 'Lausanne',
    jsonb_build_array(jsonb_build_object(
      'label', 'Stage Automne - Semaine 2 - Loisir journée, du 19.10.2026 au 23.10.2026',
      'amount', 450)),
    v.montant, 'Stage Automne - Semaine 2 — Loisir journée', 'CHF',
    v.emission, v.echeance, 'a41769c2-4f18-4066-bc2d-81e4c033d020',
    'a_envoyer', null, null
  from v
  returning id
)
update public.stage_registrations r
   set out_invoice_id = (select id from ins), invoice_created = true
 where r.id = '878ebb9d-8c76-4e9f-9cd6-72a43b802fb5';

commit;

-- Contrôle : plus aucun inscrit sans facture sur les stages à venir.
--   select r.first_name, r.last_name, coalesce(oi.number,'AUCUNE')
--     from stage_registrations r
--     join stage_sessions s on s.id = r.stage_id
--     left join out_invoices oi on oi.id = r.out_invoice_id
--    where s.end_date >= current_date and oi.id is null;
