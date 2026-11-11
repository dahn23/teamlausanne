-- 236 — GameZone, rapprochement du week-end des 7-8.11.2026 (Dan, 11.11.2026)
--
-- 1. Clôture en double. Le tournoi du samedi 07.11 a été clôturé deux fois à 70 ms
--    d'intervalle (double appui) : « Rentrées/dépenses −200 » et « Écart −2.50 » écrits
--    deux fois dans la Caisse. Le fond de départ du dimanche est donc parti 202.50 trop
--    bas (1074.95 au lieu de 1277.45), et l'écart du dimanche est sorti à +167.50 au lieu
--    de −35. Correction des lignes + verrou pour que ça ne puisse plus arriver.
--
-- 2. Mail SumUp mal lu. Le parseur attendait « 547.00 », SumUp écrit « 1,547.00 » dès
--    1000 CHF : le gros relevé du lundi était ignoré, seul le petit (40.00) du mardi entrait.
--    De plus, le relevé du lundi garde une part « À verser » (40.00) versée le lendemain,
--    qui réapparaît comme brut dans le relevé suivant : on la compte comme le versement
--    de ce reste, pas comme une nouvelle vente.

-- 1a. Verrou : deux clôtures simultanées du même tournoi passent l'une après l'autre ;
--     la seconde voit la première et n'écrit rien (différence nulle).
create or replace function public.gz_post_tournament_close(p_tournament uuid, p_net numeric, p_ecart numeric, p_label text)
 returns void language plpgsql security definer set search_path to 'public'
as $$
declare v_already numeric; v_n int; v_delta numeric;
begin
  if not (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire') or gz_manages(p_tournament)) then
    raise exception 'Non autorisé à écrire dans la caisse pour ce tournoi.';
  end if;
  perform pg_advisory_xact_lock(hashtext('gz_close:' || p_tournament::text));
  select coalesce(sum(amount), 0), count(*) into v_already, v_n from gz_caisse_ledger where tournament_id = p_tournament;
  if v_n = 0 then
    insert into gz_caisse_ledger (tournament_id, label, amount, created_by)
      values (p_tournament, 'Rentrées/dépenses — ' || p_label, round(p_net, 2), auth.uid());
    if round(coalesce(p_ecart, 0), 2) <> 0 then
      insert into gz_caisse_ledger (tournament_id, label, amount, created_by)
        values (p_tournament, 'Écart de caisse — ' || p_label, round(p_ecart, 2), auth.uid());
    end if;
  else
    v_delta := round(p_net + coalesce(p_ecart, 0) - v_already, 2);
    if v_delta <> 0 then
      insert into gz_caisse_ledger (tournament_id, label, amount, created_by)
        values (p_tournament, 'Correction après réouverture — ' || p_label, v_delta, auth.uid());
    end if;
  end if;
end $$;

-- 1b. Données du week-end 7-8.11 : doublon du samedi retiré, dimanche recalé sur le vrai fond.
delete from public.gz_caisse_ledger where id in ('53c335a7-543f-49b3-8d5c-3a44c832c0d2', '87a97621-d7d7-48f0-bc21-2ec6928248c4');
update public.gz_caisse_ledger set amount = -35.00 where id = '45e463db-1454-4e71-8d64-503219d63734';   -- 1257.45 compté − (1277.45 + 15)
update public.gz_caisse c set start_amount = 1277.45
  from public.gz_tournaments t where t.id = c.tournament_id and t.tournament_date = '2026-11-08' and c.start_amount = 1074.95;

-- 2. SumUp : montants à séparateur de milliers + reste « À verser ».
alter table public.gz_weekend_settlements add column if not exists card_pending numeric(10,2);

create or replace function public.gz_ingest_sumup_mail(p_mail uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  m     mail_messages%rowtype;
  txt   text;
  d     date;
  gross numeric; fees numeric; net numeric; pend numeric;
  wk    date;
  s     gz_weekend_settlements%rowtype;
  mm    text[];
  amt   constant text := '(-?[0-9][0-9,'']*\.[0-9]{2}) CHF';   -- 1,547.00 / 1'547.00 / 40.00
begin
  select * into m from mail_messages where id = p_mail;
  if not found then return false; end if;
  if m.account_address <> 'info@teamlausanne.ch' then return false; end if;
  if m.from_address not ilike '%sumup.com%' then return false; end if;
  if m.subject not ilike 'Relevé quotidien%' then return false; end if;
  txt := coalesce(m.body_text, '');
  if txt = '' then
    txt := regexp_replace(regexp_replace(coalesce(m.body_html, ''), '<style.*?</style>', ' ', 'gi'), '<[^>]+>', ' ', 'g');
  end if;
  txt := regexp_replace(replace(txt, '&nbsp;', ' '), '\s+', ' ', 'g');

  mm := regexp_match(txt, 'compter du (\d{2})\.(\d{2})\.(\d{2})');
  if mm is null then return false; end if;
  d := make_date(2000 + mm[3]::int, mm[2]::int, mm[1]::int);
  mm := regexp_match(txt, 'bruts par carte[^0-9]*?' || amt);
  if mm is null then return false; end if;
  gross := translate(mm[1], ',''', '')::numeric;
  mm := regexp_match(txt, 'frais de traitement pour les paiements par carte\s*' || amt, 'i');
  fees := abs(coalesce(translate(mm[1], ',''', '')::numeric, 0));
  mm := regexp_match(txt, 'crédité sur votre compte de versement\s*' || amt, 'i');
  net := coalesce(translate(mm[1], ',''', '')::numeric, gross - fees);
  mm := regexp_match(txt, 'attente de versement.*?' || amt, 'i');
  pend := coalesce(translate(mm[1], ',''', '')::numeric, 0);
  if gross = 0 and net = 0 then return false; end if;

  wk := gz_weekend_of(d);
  insert into gz_weekend_settlements (weekend_start) values (wk) on conflict (weekend_start) do nothing;
  select * into s from gz_weekend_settlements where weekend_start = wk for update;
  if s.card_validated_at is not null or p_mail = any (s.card_mail_ids) then return false; end if;

  if coalesce(s.card_pending, 0) > 0 and gross <= s.card_pending + 0.005 then
    -- Versement du reste « À verser » du relevé précédent : pas une nouvelle vente.
    update gz_weekend_settlements
       set card_fees = coalesce(card_fees, 0) + fees,
           card_net  = coalesce(card_net, 0) + net,
           card_pending = round(card_pending - gross + pend, 2),
           card_stmt_date = greatest(coalesce(card_stmt_date, d), d),
           card_mail_ids = card_mail_ids || p_mail, card_source = 'sumup', updated_at = now()
     where weekend_start = wk;
  else
    update gz_weekend_settlements
       set card_gross = coalesce(card_gross, 0) + gross,
           card_fees  = coalesce(card_fees, 0) + fees,
           card_net   = coalesce(card_net, 0) + net,
           card_pending = round(coalesce(card_pending, 0) + pend, 2),
           card_stmt_date = greatest(coalesce(card_stmt_date, d), d),
           card_mail_ids = card_mail_ids || p_mail, card_source = 'sumup', updated_at = now()
     where weekend_start = wk;
  end if;
  return true;
end $$;
revoke all on function public.gz_ingest_sumup_mail(uuid) from public, anon;
grant execute on function public.gz_ingest_sumup_mail(uuid) to authenticated;

-- Week-end 7-8.11 (déjà validé par Dan) : les deux relevés, brut 1547 corrigé par Dan.
update public.gz_weekend_settlements
   set card_gross = 1547.00, card_fees = 25.91, card_net = 1521.09, card_pending = 0, card_source = 'sumup',
       card_mail_ids = array['ff7b25b2-fa6d-4f2c-b3c3-e029b33e931d', 'b8275d9a-0f84-4b2d-b2da-1b5ddc123162']::uuid[],
       card_stmt_date = '2026-11-10', updated_at = now()
 where weekend_start = '2026-11-07';
