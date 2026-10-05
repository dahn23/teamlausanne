-- 131 — Les quatre premières factures de la console étaient déjà payées.
--
-- Rapprochement du 05.10.2026 : 261 fichiers camt.053 de PostFinance
-- (18.09.2025 → 03.10.2026, 957 crédits) relus hors console, puis croisés avec
-- les 568 factures bexio et les factures sortantes de la console.
--
-- Quatre factures de la console étaient encore « envoyee » alors que l'argent
-- était arrivé. Elles ont été payées entre le 24.09 et le 30.09.2026, soit
-- dans les six jours qui ont suivi le premier envoi — personne n'avait encore
-- importé de relevé dans Factures › Encaissements, l'onglet n'avait donc rien
-- à rapprocher.
--
--   2026-0106  Hektor Vitone    2750.—  payée le 24.09.2026
--   2026-0303  Armand Jaafar     450.—  payée le 29.09.2026
--   2026-0305  Louis Jaafar      360.—  payée le 29.09.2026
--   2026-0048  Célyan Lorival   4468.—  payée le 30.09.2026
--
-- Les quatre portent la référence QR exacte de leur facture et le montant au
-- centime : le rapprochement est certain, pas inféré.
--
-- On passe par bank_statements + bank_entries plutôt que par un simple
-- `update out_invoices`, pour deux raisons :
--
--   1. La trace. L'onglet Encaissements affiche l'historique des relevés ; une
--      facture passée à « payee » sans versement en face serait invisible et
--      inexplicable dans six mois.
--   2. L'empreinte. encEmpreinte() (admin.js) dédoublonne les imports sur
--      `value_date|amount|reference|communication[0:40]`. Les empreintes
--      ci-dessous sont calculées exactement comme le fait le navigateur —
--      montant en notation JS (2750, pas 2750.00), communication tronquée à
--      40 caractères, texte non normalisé. Quand Raphael importera ces mêmes
--      camt.053 par l'interface, les quatre lignes seront reconnues et ne
--      seront pas comptées deux fois.
--
-- validated_by / imported_by restent NULL : ces lignes viennent d'un
-- rapprochement scripté, pas du clic d'une personne. Autant que ça se voie.
--
-- Rien à faire côté bexio depuis ici : 29 factures bexio encaissées y sont
-- encore « En suspens » (dont 11 déjà relancées), mais bexio n'est pas branché
-- à la console — ça se corrige à la main dans bexio.

begin;

-- Le relevé : trois fichiers camt.053 réels, nommés pour qu'on les retrouve.
with stmt as (
  insert into bank_statements (source, format, filename, period_from, period_to, n_entries, total_credit)
  values ('postfinance', 'camt053',
          'Rapprochement rétroactif 05.10.2026 — camt.053 des 25.09, 30.09 et 01.10.2026',
          '2026-09-24', '2026-09-30', 4, 8028)
  returning id
),
lignes as (
  select * from (values
    ('2026-09-24'::date, 2750.00::numeric, 'RF0920260106', 'Yoann-Dominique Vitone',
     'CRÉDIT DONNEUR D''ORDRE: YOANN-DOMINIQUE VITONE ROUTE DES PINS 2 1885 CHESIERES MARJORIE ALABRE ROUTE DES PINS 2 1885 CHESIERES COMMUNICATIONS: SPORT-ETUDES 2026/27 - ECHEANCES 1- 2/10 (DOUBLE) - HEKTOR VITONE MONTANT DE FRAIS 0.00 CHF SHA REFERENCES: NOTPROVIDED 0113267TO5976423 260924CH0F9W556U RF0',
     '2026-09-24|2750|RF0920260106|CRÉDIT DONNEUR D''ORDRE: YOANN-DOMINIQUE ',
     '9eeb356f-f257-437c-8917-039a2ef1da00'::uuid),
    ('2026-09-29'::date, 450.00::numeric, 'RF2520260303', 'JAAFAR Fares',
     'CRÉDIT DONNEUR D''ORDRE: JAAFAR FARES AVENUE CHARLES FERDINAND RAMUZ 94 1009 PULLY COMMUNICATIONS: STAGE AUTOMNE - SEMAINE 1  LOISIR J OURNEE REFERENCES: COP433F2B2D01F54 COP433F2B2D01F54 260929CH0FARQJWL RF2520260303',
     '2026-09-29|450|RF2520260303|CRÉDIT DONNEUR D''ORDRE: JAAFAR FARES AVE',
     '31aad46c-35f4-44c3-8e15-8225c174ada4'::uuid),
    ('2026-09-29'::date, 360.00::numeric, 'RF6820260305', 'JAAFAR Fares',
     'CRÉDIT DONNEUR D''ORDRE: JAAFAR FARES AVENUE CHARLES FERDINAND RAMUZ 94 1009 PULLY COMMUNICATIONS: STAGE AUTOMNE - SEMAINE 1  LOISIR J OURNEE REFERENCES: COP123048D8118A8 COP123048D8118A8 260929CH0FARQMTY RF6820260305',
     '2026-09-29|360|RF6820260305|CRÉDIT DONNEUR D''ORDRE: JAAFAR FARES AVE',
     '69732b8e-ff6a-44b2-b0b2-6329bbff2b93'::uuid),
    ('2026-09-30'::date, 4468.00::numeric, 'RF2320260048', 'Lorival Catherine et Christophe',
     'CRÉDIT DONNEUR D''ORDRE: LORIVAL CATHERINE ET CHRISTOPHE CHEMIN DU JORAN 8A 1260 NYON REFERENCES: NOTPROVIDED 21502382776/6XXX 260930CH0FAXJWNC RF2320260048',
     '2026-09-30|4468|RF2320260048|CRÉDIT DONNEUR D''ORDRE: LORIVAL CATHERIN',
     '16392d38-9a1e-4f27-ba66-cdd340ad826a'::uuid)
  ) as t(value_date, amount, reference, debtor_name, raw, fingerprint, invoice_id)
)
insert into bank_entries
  (statement_id, value_date, amount, currency, reference, debtor_name, communication, raw,
   fingerprint, invoice_id, match_kind, status, validated_at, validated_by)
select s.id, l.value_date, l.amount, 'CHF', l.reference, l.debtor_name,
       left(l.raw, 300), left(l.raw, 300),
       l.fingerprint, l.invoice_id, 'reference', 'valide', now(), null
from lignes l cross join stmt s
-- Idempotence : si l'empreinte existe déjà, on ne refait rien.
where not exists (select 1 from bank_entries be where be.fingerprint = l.fingerprint);

-- Les factures suivent, avec la date de valeur du versement : même règle que
-- bank_entry_valider() (midi, heure locale).
update out_invoices o
   set status  = 'payee',
       paid_at = (be.value_date::text || ' 12:00:00+02')::timestamptz
  from bank_entries be
 where be.invoice_id = o.id
   and be.status = 'valide'
   and o.status = 'envoyee'
   and be.reference in ('RF0920260106','RF2520260303','RF6820260305','RF2320260048');

commit;
