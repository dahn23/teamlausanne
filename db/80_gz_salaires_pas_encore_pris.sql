-- 80 — GameZone : salaire « j'ai pris » / « pas encore pris » + solde ultérieur (21.09.2026)
--   taken = true  : pris en cash dans la caisse du tournoi (comportement historique) → sort de la caisse à la clôture.
--   taken = false : dû mais pas encore pris → compte dans les salaires du tournoi, PAS dans sa caisse.
--                   Il se solde plus tard (en une ou plusieurs fois) : « versement » (banque, la caisse ne bouge pas)
--                   ou « cash » (une ligne négative est écrite dans la Caisse au moment du solde).
alter table public.gz_salaries
  add column if not exists taken boolean not null default true,
  add column if not exists paid_amount numeric not null default 0,
  add column if not exists settled_at timestamptz,
  add column if not exists settled_method text;

alter table public.gz_salaries drop constraint if exists gz_salaries_settled_method_chk;
alter table public.gz_salaries add constraint gz_salaries_settled_method_chk
  check (settled_method is null or settled_method in ('versement', 'cash'));

-- Solder (tout ou partie) un salaire pas encore pris. Tout se fait d'un bloc : le salaire et, si cash, la Caisse.
-- La ligne de Caisse n'est PAS rattachée au tournoi (tournament_id null) : les lignes rattachées servent au calcul
-- de re-clôture (gz_post_tournament_close) et ne doivent contenir que la clôture elle-même.
create or replace function public.gz_settle_salary(p_salary uuid, p_amount numeric, p_method text)
 returns void language plpgsql security definer set search_path to 'public'
as $$
declare s gz_salaries%rowtype; v_rest numeric; v_amt numeric; v_who text; v_date date;
begin
  if not (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire') or is_gz_official(auth.uid())) then
    raise exception 'Non autorisé à solder un salaire.';
  end if;
  if p_method not in ('versement', 'cash') then raise exception 'Moyen inconnu (versement ou cash).'; end if;
  select * into s from gz_salaries where id = p_salary for update;
  if not found then raise exception 'Salaire introuvable.'; end if;
  if s.taken then raise exception 'Ce salaire a déjà été pris en caisse le jour du tournoi.'; end if;
  v_rest := round(s.amount - s.paid_amount, 2);
  v_amt := round(coalesce(p_amount, 0), 2);
  if v_amt <= 0 then raise exception 'Montant requis.'; end if;
  if v_amt > v_rest then raise exception 'Le montant dépasse le reste dû (% CHF).', v_rest; end if;

  update gz_salaries
     set paid_amount = paid_amount + v_amt,
         settled_method = p_method,
         settled_at = case when paid_amount + v_amt >= amount then now() else null end
   where id = p_salary;

  if p_method = 'cash' then
    select coalesce(nullif(trim(s.name), ''), trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), 'salaire')
      into v_who from (select 1) x left join people p on p.id = s.person_id;
    select tournament_date into v_date from gz_tournaments where id = s.tournament_id;
    insert into gz_caisse_ledger (tournament_id, label, amount, created_by)
    values (null, 'Salaire soldé en cash — ' || v_who || coalesce(' (GameZone du ' || to_char(v_date, 'DD.MM.YYYY') || ')', ''), -v_amt, auth.uid());
  end if;
end $$;

revoke all on function public.gz_settle_salary(uuid, numeric, text) from public, anon;
grant execute on function public.gz_settle_salary(uuid, numeric, text) to authenticated;

-- Résumé financier : l'encaissé d'un joueur = prix − part payée par son crédit (db/71), comme dans la gestion du tournoi.
create or replace view public.gz_tournament_finance with (security_invoker = true) as
 select t.id as tournament_id, t.name, t.tournament_date, t.season_id,
    (select count(*) from gz_player_status s where s.tournament_id = t.id and s.absent = false) as presents,
    coalesce((select sum(s.amount_paid - coalesce(s.credit_used, 0)) from gz_player_status s where s.tournament_id = t.id and s.pay_method = 'cash'), 0)
      + coalesce((select sum(p.amount) from gz_payments p where p.tournament_id = t.id and p.method = 'cash'), 0) as cash,
    coalesce((select sum(s.amount_paid - coalesce(s.credit_used, 0)) from gz_player_status s where s.tournament_id = t.id and s.pay_method = 'twint'), 0)
      + coalesce((select sum(p.amount) from gz_payments p where p.tournament_id = t.id and p.method = 'twint'), 0) as twint,
    coalesce((select sum(s.amount_paid - coalesce(s.credit_used, 0)) from gz_player_status s where s.tournament_id = t.id and s.pay_method = 'carte'), 0)
      + coalesce((select sum(p.amount) from gz_payments p where p.tournament_id = t.id and p.method = 'carte'), 0) as carte,
    coalesce((select sum(sa.amount) from gz_salaries sa where sa.tournament_id = t.id), 0) as salaires
   from gz_tournaments t;
