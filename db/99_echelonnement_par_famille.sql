-- Échelonnement par famille (24.09.2026)
--
-- Les abonnements KidsTennis, Club, Compétition et Performance se paient en une
-- fois — c'est la règle. Mais une famille peut demander à étaler, et il faut
-- pouvoir le noter une fois pour toutes plutôt que de s'en souvenir d'année en
-- année ou de refaire le découpage à la main à chaque facturation.
--
-- Une ligne par joueur et par saison : l'arrangement vaut pour une saison, pas
-- pour toujours. Sans ligne, c'est un paiement unique.
--
-- Table à part et NON player_contracts, bien que ce dernier porte déjà un champ
-- « Instalments » : écrire dans player_contracts déclenche la facturation
-- automatique du sport-études (trigger player_contract_facturer, db/65). Noter
-- qu'une famille de KidsTennis paie en trois fois aurait silencieusement émis
-- un échéancier de sport-études.
create table if not exists public.billing_plans (
  person_id   uuid not null references public.people(id)  on delete cascade,
  season_id   uuid not null references public.seasons(id) on delete cascade,
  instalments int  not null default 1 check (instalments between 1 and 12),
  note        text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  primary key (person_id, season_id)
);

alter table public.billing_plans enable row level security;

-- Mêmes droits que les factures : c'est une décision de facturation.
drop policy if exists bp_finance on public.billing_plans;
create policy bp_finance on public.billing_plans for all
  using (can_finance(auth.uid())) with check (can_finance(auth.uid()));

grant select, insert, update, delete on public.billing_plans to authenticated;
