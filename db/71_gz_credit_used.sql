-- 71_gz_credit_used.sql
-- GameZone : paiement partiel ou total d'une inscription avec le crédit du joueur.
-- amount_paid reste le PRIX de l'inscription ; credit_used est la part réglée par le crédit ;
-- l'encaissé réel (cash / twint / carte selon pay_method) vaut amount_paid - credit_used.
-- Le solde du crédit reste sur gz_participants.credit_chf pour une prochaine fois.
alter table public.gz_player_status add column if not exists credit_used numeric(10,2) not null default 0;
