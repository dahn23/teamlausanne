-- 45_out_invoice_items.sql
-- Factures émises éditables : articles (items jsonb = [{label, amount}]) ; amount = somme des articles.
-- Sport-études / pro : factures générées depuis le contrat de la fiche (montant annuel ÷ n, échéances mensuelles).
-- Facture personnelle (une personne) et facture blanche (nom libre) via l'éditeur.
alter table public.out_invoices add column if not exists items jsonb not null default '[]'::jsonb;
