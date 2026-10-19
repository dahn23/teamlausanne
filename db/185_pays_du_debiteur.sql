-- 185 — Le pays du débiteur, sur la fiche et sur la facture.
--
-- Constat du 19.10.2026. Une famille habite Divonne-les-Bains, en France.
-- L'adresse se saisissait sans problème — rue, NPA, localité — mais la
-- QR-facture écrivait « CH » en dur dans son code, pour le créancier comme
-- pour le débiteur :
--
--   ..., inv.debtor_zip, inv.debtor_city.slice(0, 35), "CH"]
--
-- Le paiement serait sans doute passé : la banque lit l'IBAN et la référence.
-- Mais le bloc « Payable par » annonçait une adresse suisse avec un code
-- postal français, et le code QR affirmait la même chose. Sur un document
-- comptable, c'est faux, et ça se découvre au mauvais moment.
--
-- Deux colonnes, et rien d'autre :
--
-- · people.country — le pays de la personne. NULL = Suisse. On ne remplit pas
--   350 fiches avec « CH » pour la seule raison qu'une famille a déménagé :
--   l'absence de valeur est déjà une réponse, et c'est la bonne dans 99 % des
--   cas.
--
-- · out_invoices.debtor_country — le pays recopié sur la facture au moment où
--   elle est émise, comme le sont déjà le nom, la rue, le NPA et la localité.
--   Une facture est une photographie : si la famille déménage en mars, celles
--   de janvier doivent continuer à dire où elles ont été envoyées.
--
-- Le code à deux lettres (ISO 3166-1), parce que c'est ce qu'attend le format
-- Swiss QR-bill. Le libellé affiché est déduit à l'écran.

begin;

alter table public.people
  add column if not exists country text;

comment on column public.people.country is
  'Code pays ISO à deux lettres (FR, IT, DE…). NULL = Suisse : on ne remplit pas toutes les fiches pour dire l''évidence.';

alter table public.out_invoices
  add column if not exists debtor_country text;

comment on column public.out_invoices.debtor_country is
  'Pays du débiteur au moment de l''émission, recopié depuis la fiche. NULL = CH. Part dans le code QR et dans le bloc « Payable par ».';

-- Garde-fou : deux lettres majuscules, ou rien. Une colonne libre finirait par
-- contenir « France », « france » et « FRA » — trois valeurs pour un pays, et
-- un code QR invalide à la clé.
alter table public.people
  drop constraint if exists people_country_iso2;
alter table public.people
  add constraint people_country_iso2 check (country is null or country ~ '^[A-Z]{2}$');

alter table public.out_invoices
  drop constraint if exists out_invoices_debtor_country_iso2;
alter table public.out_invoices
  add constraint out_invoices_debtor_country_iso2 check (debtor_country is null or debtor_country ~ '^[A-Z]{2}$');

commit;
