-- 132 — Talia Picci : la mensualité de septembre est encaissée.
--
-- Précision de Raphael le 05.10.2026 : cette saison, Talia Picci paie
-- 1050.— par mois, facturés à sa mère (Nicolina Picci) à la fin de chaque
-- mois. Ça lève l'ambiguïté qui restait au rapprochement : deux versements de
-- 1050.— sont arrivés sans référence QR, et rien ne disait à quel mois les
-- rattacher.
--
--   26.08.2026  1050.—  Picci Nicolina  « Académie Talia Picci »
--   28.09.2026  1050.—  Picci Nicolina  « Académie Talia Picci »
--
-- Le second est la mensualité de septembre : il tombe en fin de mois, au
-- montant exact, et vient de la débitrice de la facture. On rattache donc
-- 2026-0308 (mensualité 2/12, septembre) et on l'encaisse.
--
-- Le premier reste **à rapprocher**, volontairement. Il n'y a pas de
-- mensualité 1/12 dans l'échéancier : il va de 2/12 (septembre) à 12/12
-- (juillet), onze factures. La facture annulée 2026-0075 parlait d'un
-- « acompte déduit » — ce versement d'août est très probablement cet acompte,
-- déjà pris en compte dans le plan. Comme c'est une déduction et pas une
-- facture, il n'y a rien à encaisser en face, et deviner serait pire que
-- laisser la ligne visible dans Encaissements.
--
-- ⚠️ À vérifier avec Raphael : onze mensualités font 11'550.—. Si la saison
-- se paie en douze fois (12'600.—), il manque une facture ; si l'acompte
-- d'août tient la place de la douzième, le compte est juste. L'échéancier ne
-- permet pas de trancher tout seul.
--
-- Les deux versements sont insérés avec l'empreinte que calcule le navigateur
-- (encEmpreinte, admin.js) : réimporter les camt.053 du 27.08 et du 29.09 par
-- l'interface les reconnaîtra au lieu de les compter deux fois. Noter que la
-- référence est vide dans l'empreinte — ces virements n'en portent aucune,
-- ni dans le champ structuré ni dans le texte libre.

begin;

with stmt as (
  insert into bank_statements (source, format, filename, period_from, period_to, n_entries, total_credit)
  values ('postfinance', 'camt053',
          'Rapprochement Picci 05.10.2026 — camt.053 des 27.08 et 29.09.2026',
          '2026-08-26', '2026-09-28', 2, 2100)
  returning id
),
lignes as (
  select * from (values
    -- Acompte d'août : aucune facture en face, reste à rapprocher.
    ('2026-08-26'::date, 1050.00::numeric, 'Picci Nicolina', 'Académie Talia Picci',
     '2026-08-26|1050||Académie Talia Picci', null::uuid, null::text, 'a_valider'),
    -- Mensualité de septembre → 2026-0308.
    ('2026-09-28'::date, 1050.00::numeric, 'Picci Nicolina', 'Académie Talia Picci',
     '2026-09-28|1050||Académie Talia Picci',
     (select id from out_invoices where number = '2026-0308'), 'manuel', 'valide')
  ) as t(value_date, amount, debtor_name, comm, fingerprint, invoice_id, match_kind, status)
)
insert into bank_entries
  (statement_id, value_date, amount, currency, reference, debtor_name, communication, raw,
   fingerprint, invoice_id, match_kind, status, validated_at, validated_by)
select s.id, l.value_date, l.amount, 'CHF', null, l.debtor_name, l.comm, l.comm,
       l.fingerprint, l.invoice_id, l.match_kind, l.status,
       case when l.status = 'valide' then now() end, null
from lignes l cross join stmt s
where not exists (select 1 from bank_entries be where be.fingerprint = l.fingerprint);

-- Même règle que bank_entry_valider() : la facture prend la date de valeur.
update out_invoices o
   set status  = 'payee',
       paid_at = (be.value_date::text || ' 12:00:00+02')::timestamptz
  from bank_entries be
 where be.invoice_id = o.id
   and be.status = 'valide'
   and o.status in ('a_envoyer', 'envoyee')
   and o.number = '2026-0308';

commit;
