-- 231 — Isabella Stadelmann : tranches ramenées à 1670.— (06.11.2026)
--
-- Plus de séance le lundi depuis novembre, et la leçon privée de 2 h du lundi
-- sort du forfait. Montant décidé par Raphael : 1670.— par tranche au lieu de
-- 2230.—, à partir de l'échéance 4/10 (30.11.2026).
--
-- Ce qui ne bouge pas : 2026-0115 (4460.—, échéances 1-2, déjà envoyée) et
-- 2026-0116 (2230.—, payée le 04.11). Les séances du lundi ont bien eu lieu
-- jusqu'au 26.10 — six séances depuis le 31.08 — donc ces deux factures-là
-- restent dues telles quelles. Aucune n'est à créditer, aucune à renvoyer.
--
-- Saison réellement facturée : 4460 + 2230 + 7 × 1670 = 18380.— (au lieu de
-- 22300.—).
--
-- ⚠️ LE PIÈGE, et c'est le cœur de cette migration : les sept factures « à
-- envoyer » avaient DÉJÀ leur PDF, fabriqué à 2230.— — code QR compris. Ne
-- changer que `amount` aurait laissé partir aux parents un PDF et un QR à
-- 2230.— sur une facture à 1670.— en base : le paiement serait tombé au
-- mauvais montant, et le rapprochement aurait réclamé la différence. On remet
-- donc `pdf_path` à null : la console refabrique tout PDF manquant d'une
-- facture « à envoyer » à l'ouverture de Factures › Émises, et oiMakePdf
-- écrit sur `<id>.pdf` avec upsert — l'ancien fichier est écrasé.
--
-- Et `items` aussi : c'est la ligne imprimée sur le PDF. `amount` seul aurait
-- donné un total de 1670.— sous une ligne de détail à 2230.—.

update out_invoices
set amount = 1670,
    items = jsonb_build_array(jsonb_build_object('label', items->0->>'label', 'amount', 1670)),
    pdf_path = null,
    note = coalesce(note || ' ', '')
           || 'Montant ramené de 2230.— à 1670.— le 06.11.2026 : plus de séance du lundi depuis novembre '
           || '(la leçon privée de 2 h du lundi sort du forfait). PDF et code QR refaits.'
where person_id = '8aa88f2c-5555-418c-8684-62c6908a3b34'   -- Isabella Stadelmann
  and filiere = 'sport-etudes'
  and status = 'a_envoyer'
  and sent_at is null                                       -- garde-fou : jamais une facture déjà partie
  and amount = 2230;
-- 7 lignes : 2026-0117 (30.11) à 2026-0123 (30.05).

-- Le contrat suit, sinon il raconte encore l'ancienne somme.
update player_contracts
set data = data
      || jsonb_build_object(
           'Monthly fee', '1670',
           'Annual fee', '18380',
           'Private sessions', jsonb_build_array('2h','2h'),   -- la 3ᵉ était celle du lundi
           'Notes', trim(coalesce(data->>'Notes','') || ' 06.11.2026 : plus de séance le lundi, et la leçon privée de 2 h du lundi sort du forfait. '
                    || 'Tranches ramenées de 2230.— à 1670.— à partir de l''échéance 4/10 (30.11.2026). '
                    || 'Total réellement facturé sur la saison : 4460 + 2230 + 7 × 1670 = 18380.—. '
                    || 'Attention : 18380 ne se divise pas en 10 tranches égales — le changement est en cours de saison. '
                    || 'Ne pas regénérer l''échéancier depuis ce contrat, les factures existent déjà.')),
    updated_at = now()
where person_id = '8aa88f2c-5555-418c-8684-62c6908a3b34';

-- Vérification :
--   select number, amount, (items->0->>'amount')::numeric as ligne, status, pdf_path
--   from out_invoices
--   where person_id = '8aa88f2c-5555-418c-8684-62c6908a3b34' and filiere = 'sport-etudes'
--   order by instalment_no;
-- Attendu : 4460 et 2230 intactes avec leur PDF ; sept lignes à 1670 avec
-- amount = ligne et pdf_path null.
