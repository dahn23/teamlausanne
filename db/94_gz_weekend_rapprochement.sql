-- GameZone — rapprochement des encaissements par WEEK-END (23.09.2026)
--
-- Le samedi et le dimanche sont deux tournois dans la console, mais UN SEUL
-- versement carte (mail SumUp du mardi « Relevé quotidien de vos paiements ») et,
-- plus tard, un seul relevé Twint. On rapproche donc par week-end :
--   * cash  : quelqu'un compte la caisse et valide le montant ;
--   * carte : le mail SumUp est lu automatiquement (brut / frais / versé), le brut
--             doit égaler le « Carte » de la console, on valide ;
--   * twint : même principe, parseur à brancher quand le premier mail arrivera
--             (en attendant : saisie manuelle).
-- Le « réel » (montant versé, frais déduits) remplace ensuite le montant console
-- dans le net final du Résumé financier, réparti au prorata entre les tournois.

create table if not exists public.gz_weekend_settlements (
  id                 uuid primary key default gen_random_uuid(),
  weekend_start      date not null unique,            -- le samedi
  -- cash (caisse comptée)
  cash_counted       numeric(10,2),
  cash_validated_at  timestamptz,
  cash_validated_by  text,
  -- carte (SumUp)
  card_gross         numeric(10,2),                    -- brut encaissé selon SumUp
  card_fees          numeric(10,2),                    -- frais SumUp (positif)
  card_net           numeric(10,2),                    -- versé sur le compte
  card_stmt_date     date,                             -- « à compter du » du relevé
  card_mail_ids      uuid[] not null default '{}',     -- mails déjà comptés (pas de double)
  card_source        text,                             -- sumup | manuel
  card_validated_at  timestamptz,
  card_validated_by  text,
  -- twint
  twint_gross        numeric(10,2),
  twint_fees         numeric(10,2),
  twint_net          numeric(10,2),
  twint_mail_ids     uuid[] not null default '{}',
  twint_source       text,                             -- twint | manuel
  twint_validated_at timestamptz,
  twint_validated_by text,
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz
);
alter table public.gz_weekend_settlements enable row level security;
drop policy if exists gzws_read on public.gz_weekend_settlements;
create policy gzws_read on public.gz_weekend_settlements for select to authenticated
  using (is_staff(auth.uid()) or is_gz_official(auth.uid()));
drop policy if exists gzws_manage on public.gz_weekend_settlements;
create policy gzws_manage on public.gz_weekend_settlements for all to authenticated
  using (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire'::app_role))
  with check (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire'::app_role));
grant select, insert, update, delete on public.gz_weekend_settlements to authenticated;

-- Samedi du week-end auquel appartient une date (lundi→vendredi = week-end précédent :
-- c'est la logique des relevés, qui arrivent après coup).
create or replace function public.gz_weekend_of(d date)
returns date language sql immutable as $$
  select d - ((extract(dow from d)::int + 1) % 7);
$$;

-- Lecture d'un mail SumUp « Relevé quotidien » : brut / frais / versé / date.
-- Renvoie true si le mail a été pris en compte.
create or replace function public.gz_ingest_sumup_mail(p_mail uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  m     mail_messages%rowtype;
  txt   text;
  d     date;
  gross numeric; fees numeric; net numeric;
  wk    date;
  mm    text[];
begin
  select * into m from mail_messages where id = p_mail;
  if not found then return false; end if;
  if m.account_address <> 'info@teamlausanne.ch' then return false; end if;      -- le SumUp de lausanneopen.ch est un autre compte
  if m.from_address not ilike '%sumup.com%' then return false; end if;
  if m.subject not ilike 'Relevé quotidien%' then return false; end if;         -- les relevés mensuels ne servent pas ici
  txt := coalesce(m.body_text, '');
  if txt = '' then
    txt := regexp_replace(regexp_replace(coalesce(m.body_html, ''), '<style.*?</style>', ' ', 'gi'), '<[^>]+>', ' ', 'g');
  end if;
  txt := regexp_replace(replace(txt, '&nbsp;', ' '), '\s+', ' ', 'g');

  mm := regexp_match(txt, 'compter du (\d{2})\.(\d{2})\.(\d{2})');
  if mm is null then return false; end if;
  d := make_date(2000 + mm[3]::int, mm[2]::int, mm[1]::int);
  mm := regexp_match(txt, 'bruts par carte[^0-9]*?(-?\d+\.\d{2}) CHF');
  if mm is null then return false; end if;
  gross := mm[1]::numeric;
  mm := regexp_match(txt, 'frais de traitement pour les paiements par carte\s*(-?\d+\.\d{2}) CHF', 'i');
  fees := abs(coalesce(mm[1]::numeric, 0));
  mm := regexp_match(txt, 'crédité sur votre compte de versement\s*(-?\d+\.\d{2}) CHF', 'i');
  net := coalesce(mm[1]::numeric, gross - fees);
  if gross = 0 and net = 0 then return false; end if;                            -- relevé vide (aucun paiement)

  wk := gz_weekend_of(d);
  insert into gz_weekend_settlements (weekend_start) values (wk) on conflict (weekend_start) do nothing;
  update gz_weekend_settlements s
     set card_gross = coalesce(s.card_gross, 0) + gross,
         card_fees  = coalesce(s.card_fees, 0) + fees,
         card_net   = coalesce(s.card_net, 0) + net,
         card_stmt_date = greatest(coalesce(s.card_stmt_date, d), d),
         card_mail_ids = s.card_mail_ids || p_mail,
         card_source = 'sumup',
         updated_at = now()
   where s.weekend_start = wk
     and s.card_validated_at is null                                             -- une fois validé, on ne touche plus
     and not (p_mail = any (s.card_mail_ids));                                   -- jamais deux fois le même mail
  return found;
end $$;

-- Mail Twint : on ne connaît pas encore le format du relevé. On accroche le mail
-- au week-end (le tableau de bord dira « mail Twint reçu, à saisir ») sans montant.
create or replace function public.gz_ingest_twint_mail(p_mail uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare m mail_messages%rowtype; wk date;
begin
  select * into m from mail_messages where id = p_mail;
  if not found then return false; end if;
  if m.account_address <> 'info@teamlausanne.ch' then return false; end if;
  if m.from_address not ilike '%twint%' then return false; end if;
  if m.subject ilike 'Transaction de CHF%' then return false; end if;             -- notification par paiement, pas un relevé
  wk := gz_weekend_of(m.received_at::date);
  insert into gz_weekend_settlements (weekend_start) values (wk) on conflict (weekend_start) do nothing;
  update gz_weekend_settlements s
     set twint_mail_ids = s.twint_mail_ids || p_mail, twint_source = coalesce(s.twint_source, 'twint'), updated_at = now()
   where s.weekend_start = wk and s.twint_validated_at is null and not (p_mail = any (s.twint_mail_ids));
  return found;
end $$;

create or replace function public.gz_mail_settlement_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.direction is distinct from 'out' then
    perform gz_ingest_sumup_mail(new.id);
    perform gz_ingest_twint_mail(new.id);
  end if;
  return new;
end $$;
drop trigger if exists trg_gz_mail_settlement on public.mail_messages;
create trigger trg_gz_mail_settlement
  after insert on public.mail_messages
  for each row execute function public.gz_mail_settlement_trg();

-- Vue par week-end : ce que dit la console (somme des tournois du samedi + dimanche)
-- + ce que disent les relevés. security_invoker : la RLS des tournois s'applique.
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
         s.note
    from t full join gz_weekend_settlements s on s.weekend_start = t.weekend_start;

revoke all on function public.gz_ingest_sumup_mail(uuid) from public, anon;
revoke all on function public.gz_ingest_twint_mail(uuid) from public, anon;
grant execute on function public.gz_ingest_sumup_mail(uuid) to authenticated;
grant execute on function public.gz_ingest_twint_mail(uuid) to authenticated;

-- Reprise : les mails SumUp / Twint déjà dans la boîte.
select gz_ingest_sumup_mail(id) from mail_messages
 where from_address ilike '%sumup.com%' and subject ilike 'Relevé quotidien%' and account_address = 'info@teamlausanne.ch';
select gz_ingest_twint_mail(id) from mail_messages
 where from_address ilike '%twint%' and subject not ilike 'Transaction de CHF%' and account_address = 'info@teamlausanne.ch';
