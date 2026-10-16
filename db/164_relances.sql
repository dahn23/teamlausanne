-- ===================================================================
--  FACTURES › RELANCES (rappels) — point 2 de la liste du 16.10.2026
-- ===================================================================
-- L'onglet Impayées savait déjà lister les factures échues et renvoyer la
-- facture par mail. Il lui manquait trois choses, et chacune coûte de l'argent
-- ou de la crédibilité :
--
--  1. Il relançait le montant de la FACTURE, pas ce qui reste dû. Une famille
--     qui a déjà versé 400 sur 815 recevait un rappel de 815. C'est faux, et
--     c'est le genre d'erreur qui fait qu'on arrête de payer.
--
--  2. Il renvoyait la facture d'origine. Le mail disait « rappel », le document
--     disait « FACTURE ». Rien ne portait le NUMÉRO du rappel, donc rien ne
--     disait à la famille où elle en était — ni au secrétariat.
--
--  3. Le niveau montait sans fin. Un 7e rappel n'existe pas : après le
--     troisième on va aux poursuites, et le document doit le dire.
--
-- ⚠️ CE QU'UNE RELANCE N'EST PAS : une nouvelle facture. Créer une ligne de
-- 815 CHF à côté d'une facture de 815 CHF impayée doublerait le « à
-- encaisser » — deux vérités pour une seule créance. Une relance est donc un
-- ÉVÉNEMENT sur la facture : l'argent reste compté une fois, et l'onglet
-- Relances est une LECTURE des factures échues, pas un second grand-livre.

-- ---- 1) Ce qu'un rappel doit retenir -------------------------------
-- amount = le reste dû AU MOMENT du rappel. Figé, comme le PDF parti chez la
-- famille : six mois plus tard on doit pouvoir dire ce qu'on a réclamé, pas
-- recalculer ce qu'on réclamerait aujourd'hui.
alter table out_invoice_reminders
  add column if not exists amount   numeric,
  add column if not exists due_date date,
  add column if not exists pdf_path text;

alter table out_invoice_reminders drop constraint if exists oir_niveau_1_3;
alter table out_invoice_reminders
  add constraint oir_niveau_1_3 check (level between 1 and 3);

-- Un seul rappel de chaque niveau par facture : sans cela, deux personnes au
-- secrétariat cliquant en même temps envoient deux « 2e rappel ».
create unique index if not exists oir_un_par_niveau
  on out_invoice_reminders (invoice_id, level);

-- ---- 2) « Ne pas relancer avant le … » -----------------------------
-- La famille a téléphoné, un arrangement est pris. Sans cet endroit pour le
-- noter, l'information vit dans la tête d'une personne et le rappel part quand
-- même.
alter table out_invoices
  add column if not exists relance_pause_jusqu date;

comment on column out_invoices.relance_pause_jusqu is
  'Arrangement pris avec la famille : aucune relance proposée avant cette date.';

-- ---- 3) Les relances à envoyer -------------------------------------
-- Vue, donc toujours juste : une facture entre ici le lendemain de son
-- échéance et en sort à la seconde où elle est payée. Rien à cocher, rien à
-- tenir à jour, aucun travail de nuit à surveiller.
--
-- « bloque » dit POURQUOI une facture échue n'est pas à relancer aujourd'hui
-- (NULL = elle l'est). On l'affiche au lieu de masquer la ligne : une facture
-- qui disparaît sans explication se traduit par un appel au secrétariat.
create or replace view out_relances_a_envoyer as
with r as (
  select invoice_id, count(*) as n, max(level) as niveau, max(sent_at) as dernier
    from out_invoice_reminders
   group by invoice_id
)
select s.id, s.number, s.debtor_name, s.debtor_email, s.debtor_person_id,
       s.debtor_street, s.debtor_zip, s.debtor_city,
       s.person_id, s.filiere, s.product_id, pr.name as produit,
       s.amount as montant_facture, s.verse, s.avoir, s.reste,
       s.currency, s.items, s.label, s.reference, s.account_id,
       s.issue_date, s.due_date, s.pdf_path, s.statut_reel,
       (current_date - s.due_date)::int as jours_retard,
       coalesce(r.n, 0)::int            as rappels,
       r.dernier                        as dernier_rappel,
       least(coalesce(r.niveau, 0) + 1, 3)::int as prochain_niveau,
       o.relance_pause_jusqu,
       case
         when coalesce(r.niveau, 0) >= 3                               then 'trois rappels envoyés'
         when o.relance_pause_jusqu is not null
          and o.relance_pause_jusqu >= current_date                    then 'en pause jusqu''au '
              || to_char(o.relance_pause_jusqu, 'DD.MM.YYYY')
         -- Dix jours entre deux rappels : c'est le délai qu'on accorde sur le
         -- document. Relancer avant d'avoir attendu son propre délai nous
         -- décrédibilise.
         when r.dernier is not null
          and r.dernier > now() - interval '10 days'                   then 'rappel envoyé le '
              || to_char(r.dernier, 'DD.MM.YYYY')
         when coalesce(s.debtor_email, '') = ''                        then 'pas d''adresse e-mail'
       end as bloque
  from out_invoices_solde s
  join out_invoices o            on o.id = s.id
  left join invoice_products pr  on pr.id = s.product_id
  left join r                    on r.invoice_id = s.id
 where s.due_date is not null
   and s.due_date < current_date
   and s.status = 'envoyee'          -- on ne relance pas une facture jamais partie
   and s.statut_reel not in ('payee', 'annulee')
   and s.reste > 0.005;              -- un solde payé à 2 centimes près est payé

comment on view out_relances_a_envoyer is
  'Factures échues et non soldées. bloque IS NULL = relance à envoyer aujourd''hui.';

-- ---- 4) L'historique des relances ----------------------------------
-- Ce qui est PARTI, avec sa date, son niveau et le montant réclamé. Le pendant
-- de la vue ci-dessus : l'une dit ce qu'il reste à faire, l'autre ce qui a été
-- fait. On en a besoin le jour où une famille affirme n'avoir rien reçu.
create or replace view out_relances as
select rl.id, rl.invoice_id, rl.level, rl.amount, rl.due_date, rl.sent_at,
       rl.to_email, rl.sent_by, rl.pdf_path,
       f.number, f.debtor_name, f.person_id, f.filiere, f.product_id,
       pr.name as produit, f.amount as montant_facture, f.due_date as echeance,
       sl.reste, sl.statut_reel
  from out_invoice_reminders rl
  join out_invoices f           on f.id = rl.invoice_id
  left join out_invoices_solde sl on sl.id = rl.invoice_id
  left join invoice_products pr on pr.id = f.product_id;

-- ---- 5) Droits ------------------------------------------------------
-- Même porte que les factures elles-mêmes : une relance EST un document de
-- facturation. Deux règles différentes pour la facture et son rappel finiraient
-- par se contredire.
alter table out_invoice_reminders enable row level security;
drop policy if exists oir_finance on out_invoice_reminders;
create policy oir_finance on out_invoice_reminders
  for all using (can_billing(auth.uid())) with check (can_billing(auth.uid()));

grant select on out_relances_a_envoyer, out_relances to authenticated;
