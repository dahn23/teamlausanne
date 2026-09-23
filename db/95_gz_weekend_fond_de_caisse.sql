-- Rapprochement par week-end : le CASH se contrôle par le FOND DE CAISSE (23.09.2026).
-- Ce qu'on compte le dimanche soir (ou le lundi), c'est la caisse entière, pas les
-- seules rentrées du week-end. La vue expose donc, depuis le journal de caisse :
--   * till_before : solde de la caisse juste avant le premier mouvement du week-end ;
--   * till_after  : solde juste après le dernier mouvement du week-end (clôture du dimanche,
--                   écart de caisse compris).
-- On saisit le fond compté (till_counted) ; le cash déduit = compté − till_before.

alter table public.gz_weekend_settlements add column if not exists till_counted numeric(10,2);

create or replace view public.gz_weekends with (security_invoker = true) as
  with t as (
    select gz_weekend_of(f.tournament_date) as weekend_start, f.season_id,
           count(*) as n_tournois,
           array_agg(f.tournament_id order by f.tournament_date) as tournament_ids,
           sum(f.presents) as presents,
           sum(f.cash) as cash, sum(f.twint) as twint, sum(f.carte) as carte, sum(f.salaires) as salaires
      from gz_tournament_finance f
     group by 1, 2
  )
  select coalesce(t.weekend_start, s.weekend_start) as weekend_start,
         t.season_id, coalesce(t.n_tournois, 0) as n_tournois, coalesce(t.tournament_ids, '{}') as tournament_ids,
         coalesce(t.presents, 0) as presents,
         coalesce(t.cash, 0) as cash, coalesce(t.twint, 0) as twint, coalesce(t.carte, 0) as carte, coalesce(t.salaires, 0) as salaires,
         s.id as settlement_id,
         s.cash_counted, s.cash_validated_at, s.cash_validated_by,
         s.card_gross, s.card_fees, s.card_net, s.card_stmt_date, s.card_source, s.card_validated_at, s.card_validated_by,
         cardinality(s.card_mail_ids) as card_mails,
         s.twint_gross, s.twint_fees, s.twint_net, s.twint_source, s.twint_validated_at, s.twint_validated_by,
         cardinality(s.twint_mail_ids) as twint_mails,
         s.note,
         till.till_before, till.till_after, s.till_counted
    from t full join gz_weekend_settlements s on s.weekend_start = t.weekend_start
    left join lateral (
      select case when b.first_at is null then null
                  else (select coalesce(sum(l.amount), 0) from gz_caisse_ledger l where l.created_at < b.first_at) end as till_before,
             case when b.last_at is null then null
                  else (select coalesce(sum(l.amount), 0) from gz_caisse_ledger l where l.created_at <= b.last_at) end as till_after
        from (select min(l.created_at) as first_at, max(l.created_at) as last_at
                from gz_caisse_ledger l where l.tournament_id = any (coalesce(t.tournament_ids, '{}'))) b
    ) till on true;
