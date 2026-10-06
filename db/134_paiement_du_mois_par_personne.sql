-- 134 — Cocher « payé », personne par personne, pour le mois.
--
-- Question de Raphael le 06.10.2026 : comment noter dans l'onglet Heures
-- qu'une personne a été payée pour le mois, et voir d'un coup d'œil s'il
-- reste quelqu'un. La réponse était : impossible, sauf pour les trois
-- indépendants « sur facture » câblés la veille (db/133).
--
-- Le cycle du mois s'arrêtait à « clôturé ». payroll_months porte pourtant
-- sent_at/paid_at depuis db/101 — colonnes jamais écrites par personne ; et
-- salary_slips, qui reçoit les nets de la fiduciaire, n'a aucun état de
-- paiement. Rien ne disait donc qui avait été payé.
--
-- Un état par personne ET par mois, pas au mois seul : les virements ne
-- partent pas tous le même jour, et « le mois est payé » ne dit pas s'il
-- manque quelqu'un — c'est exactement ce que Raphael veut voir.
--
-- Pourquoi une table à part plutôt qu'un paid_at sur salary_slips :
-- un slip n'existe qu'une fois le retour de la fiduciaire importé. Les
-- indépendants sur facture n'en ont jamais, et un coach payé avant le retour
-- ne serait pas cochable. Le paiement est un fait qui ne dépend pas du slip.
--
-- Cette table devient la source unique, y compris pour les « sur facture » :
-- coach_invoice_requests.paid_at (db/133, la veille) servait au même usage
-- pour eux seuls, et deux états pour une même question divergent toujours.
-- La console lit désormais payroll_payments pour tout le monde ; la colonne
-- de db/133 est reprise ci-dessous puis laissée de côté (on ne la supprime
-- pas : la facture liée reste la preuve, et une colonne vide ne nuit pas).
--
-- Les compensés (pays_in_kind, Talia Picci) n'entrent pas dans le décompte :
-- leur travail est déduit de leur propre facture, ils ne sont jamais payés.
-- La console les exclut du « reste à payer » au lieu de les montrer en dette.

begin;

create table if not exists public.payroll_payments (
  person_id  uuid not null references public.people(id) on delete cascade,
  ym         text not null,
  paid_at    timestamptz not null default now(),
  paid_by    uuid references auth.users(id),
  amount     numeric,          -- ce qui a réellement été viré, pas le théorique
  note       text,
  updated_at timestamptz not null default now(),
  primary key (person_id, ym)
);

comment on table public.payroll_payments is
  'Un paiement, une personne, un mois. Source unique de « payé » pour l''onglet Heures : salariés, coachs à l''heure, profs d''études et indépendants sur facture.';
comment on column public.payroll_payments.amount is
  'Montant viré. Peut différer du théorique (net de la fiduciaire, heures × tarif, montant facturé) : on garde ce qui est parti.';

alter table public.payroll_payments enable row level security;
drop policy if exists pp_finance on public.payroll_payments;
create policy pp_finance on public.payroll_payments for all
  using (can_finance(auth.uid())) with check (can_finance(auth.uid()));
grant select, insert, update, delete on public.payroll_payments to authenticated;

create index if not exists payroll_payments_ym_idx on public.payroll_payments (ym);

commit;

-- ---------------------------------------------------------------------------
-- Reprise de ce que db/133 avait noté la veille : Rémi Moha, septembre 2026.

begin;

insert into public.payroll_payments (person_id, ym, paid_at, paid_by, amount, note, updated_at)
select r.person_id, r.ym, r.paid_at, r.paid_by, coalesce(i.amount, r.amount),
       'Repris de coach_invoice_requests (db/133).', now()
from public.coach_invoice_requests r
left join public.invoices i on i.id = r.invoice_id
where r.paid_at is not null
on conflict (person_id, ym) do nothing;

commit;
