-- Journal des envois automatiques de factures.
--
-- La tâche du 20 tourne toute seule. Sans trace, personne ne sait si elle a
-- tourné : un mois sans facture ressemble à un mois calme, et on s'en aperçoit
-- à la relance. On garde donc une ligne par passage, lue par le tableau de bord
-- de la console. Le récapitulatif par mail reste, mais un mail peut se perdre
-- ou finir en indésirable — le tableau de bord, non.
create table if not exists public.out_invoice_runs (
  id          uuid primary key default gen_random_uuid(),
  ran_at      timestamptz not null default now(),
  kind        text not null default 'auto',   -- 'auto' (cron) | 'essai'
  sent_count  int  not null default 0,
  failed_count int not null default 0,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists out_invoice_runs_ran_at_idx on public.out_invoice_runs (ran_at desc);

alter table public.out_invoice_runs enable row level security;

-- Lecture pour le staff seulement : ce journal nomme des familles et des
-- montants. Aucune policy d'écriture : seul le service_role (la tâche) écrit.
drop policy if exists "runs lisibles par le staff" on public.out_invoice_runs;
create policy "runs lisibles par le staff" on public.out_invoice_runs
  for select to authenticated using (public.is_staff(auth.uid()));

grant select on public.out_invoice_runs to authenticated;
