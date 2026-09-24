-- Résumé financier : « Présents » ne compte que les joueurs réellement pointés (24.09.2026).
-- Avant : toute ligne de statut non « absent » comptait, or une ligne se crée dès qu'on touche un joueur
-- (note, crédit…) → un tournoi à venir affichait « 1 présent » sans aucun paiement.
-- Maintenant : présent = pas absent ET (montant saisi, ou crédit utilisé, ou vainqueur).

create or replace view public.gz_tournament_finance with (security_invoker = true) as
 select t.id as tournament_id, t.name, t.tournament_date, t.season_id,
    (select count(*) from gz_player_status s
      where s.tournament_id = t.id and s.absent = false
        and (s.amount_paid is not null or coalesce(s.credit_used, 0) > 0 or s.is_winner)) as presents,
    coalesce((select sum(s.amount_paid - coalesce(s.credit_used, 0)) from gz_player_status s where s.tournament_id = t.id and s.pay_method = 'cash'), 0)
      + coalesce((select sum(p.amount) from gz_payments p where p.tournament_id = t.id and p.method = 'cash'), 0) as cash,
    coalesce((select sum(s.amount_paid - coalesce(s.credit_used, 0)) from gz_player_status s where s.tournament_id = t.id and s.pay_method = 'twint'), 0)
      + coalesce((select sum(p.amount) from gz_payments p where p.tournament_id = t.id and p.method = 'twint'), 0) as twint,
    coalesce((select sum(s.amount_paid - coalesce(s.credit_used, 0)) from gz_player_status s where s.tournament_id = t.id and s.pay_method = 'carte'), 0)
      + coalesce((select sum(p.amount) from gz_payments p where p.tournament_id = t.id and p.method = 'carte'), 0) as carte,
    coalesce((select sum(sa.amount) from gz_salaries sa where sa.tournament_id = t.id), 0) as salaires
   from gz_tournaments t;
