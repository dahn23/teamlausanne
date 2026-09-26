-- GameZone (26.09.2026)
-- 1. Rapprochements « fantômes » : l'import de l'archive Gmail (mails 'rescue…') avait déclenché la lecture des
--    mails SumUp/Twint et créé des rapprochements sur des week-ends sans aucune vente dans la console ; une pub
--    Twint (« Savoir qui a payé… ») et un avis « Nouveau commerce saisi » avaient été pris pour des relevés.
delete from gz_weekend_settlements s
 where cash_validated_at is null and card_validated_at is null and twint_validated_at is null and till_counted is null
   and not exists (select 1 from gz_weekends w where w.weekend_start = s.weekend_start and coalesce(w.cash,0) + coalesce(w.twint,0) + coalesce(w.carte,0) > 0);
create or replace function public.gz_mail_settlement_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.direction is distinct from 'out' and coalesce(new.imap_uid, '') not like 'rescue%' then
    perform gz_ingest_sumup_mail(new.id);
    perform gz_ingest_twint_mail(new.id);
  end if;
  return new;
end $$;
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.gz_ingest_twint_mail'::regproc);
  if position('news.' in d) = 0 then
    n := replace(d, $r$if m.subject ilike 'Transaction de CHF%' then return false; end if;$r$,
      $r$if m.subject ilike 'Transaction de CHF%' then return false; end if;
  if m.from_address ilike '%news.%' or m.subject ilike '%nouveau commerce%' or m.subject ilike '%newsletter%' then return false; end if;$r$);
    if n = d then raise exception 'gz_ingest_twint_mail : motif introuvable'; end if;
    execute n;
  end if;
end $$;

-- 2. Saison 2025/26 : tous les tournois clôturés le soir de leur date (20:00, heure suisse) et « Terminé ».
update gz_tournaments t set closed_at = ((t.tournament_date::timestamp + time '20:00') at time zone 'Europe/Zurich')
 where t.season_id = (select id from gz_seasons where name = 'Saison 2025/26') and t.closed_at is null;

-- 3. Un tournoi clôturé chez nous reste « Terminé », quoi que dise un import mytennis ultérieur.
create or replace function public.gz_tournaments_closed_status_trg() returns trigger
language plpgsql as $$
begin
  if new.closed_at is not null then new.status := 'Terminé'; end if;
  return new;
end $$;
drop trigger if exists gz_tournaments_closed_status on public.gz_tournaments;
create trigger gz_tournaments_closed_status before insert or update on public.gz_tournaments
  for each row execute function public.gz_tournaments_closed_status_trg();
update gz_tournaments set status = 'Terminé' where closed_at is not null and status is distinct from 'Terminé';
