-- 79 — GameZone (21.09.2026)
--   1. Rouvrir un tournoi clôturé (admin / superadmin uniquement).
--   2. Re-clôturer sans doubler la caisse : on ne poste que la DIFFÉRENCE avec ce qui a déjà été écrit.
--   3. Site public : vainqueurs et photos n'apparaissent qu'une fois le tournoi clôturé chez nous.

-- Ce que ce tournoi a déjà écrit dans la Caisse (lisible par le responsable du tournoi, qui n'a pas accès au grand livre).
create or replace function public.gz_tournament_posted(p_tournament uuid)
 returns numeric language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not (is_staff(auth.uid()) or gz_manages(p_tournament)) then
    raise exception 'non autorisé';
  end if;
  return (select coalesce(sum(amount), 0) from gz_caisse_ledger where tournament_id = p_tournament);
end $$;

-- Écriture de caisse à la clôture. 1re clôture : ligne « Rentrées/dépenses » + ligne « Écart » si besoin.
-- Re-clôture après réouverture : une seule ligne de correction = nouveau total − déjà écrit (rien si identique).
create or replace function public.gz_post_tournament_close(p_tournament uuid, p_net numeric, p_ecart numeric, p_label text)
 returns void language plpgsql security definer set search_path to 'public'
as $$
declare v_already numeric; v_n int; v_delta numeric;
begin
  if not (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire') or gz_manages(p_tournament)) then
    raise exception 'Non autorisé à écrire dans la caisse pour ce tournoi.';
  end if;
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

create or replace function public.gz_reopen_tournament(p_tournament uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  update gz_tournaments set closed_at = null where id = p_tournament;
  update gz_caisse set closed = false, closed_at = null where tournament_id = p_tournament;
end $$;

revoke all on function public.gz_tournament_posted(uuid) from public, anon;
revoke all on function public.gz_post_tournament_close(uuid, numeric, numeric, text) from public, anon;
revoke all on function public.gz_reopen_tournament(uuid) from public, anon;
grant execute on function public.gz_tournament_posted(uuid) to authenticated;
grant execute on function public.gz_post_tournament_close(uuid, numeric, numeric, text) to authenticated;
grant execute on function public.gz_reopen_tournament(uuid) to authenticated;

-- Les tournois d'avant la caisse (saison 2025/26) n'ont jamais été « clôturés » : on les marque clôturés
-- le lendemain de leur date, sinon leurs vainqueurs disparaîtraient du site.
update public.gz_tournaments t set closed_at = (t.tournament_date + 1)::timestamptz
where t.closed_at is null and t.tournament_date < date '2026-09-01'
  and exists (select 1 from gz_player_status st where st.tournament_id = t.id and st.is_winner);

create or replace function public.gz_public_ranking(p_season uuid default null::uuid)
 returns table(first_name text, last_name text, wins bigint)
 language sql stable security definer set search_path to 'public'
as $function$
  select p.first_name, p.last_name, count(distinct t.id) as wins
  from gz_player_status st
  join gz_tournaments t on t.id = st.tournament_id
  join gz_participants p on p.id = st.participant_id
  where st.is_winner = true and t.is_gamezone = true
    and t.closed_at is not null
    and (p_season is null or t.season_id = p_season)
  group by p.id, p.first_name, p.last_name
  having count(distinct t.id) > 0
  order by wins desc, p.first_name, p.last_name;
$function$;

create or replace function public.gz_public_winner_photos(p_season uuid default null::uuid)
 returns table(photo_url text, tournament_date date)
 language sql stable security definer set search_path to 'public'
as $function$
  select st.photo_url, t.tournament_date
  from gz_player_status st
  join gz_tournaments t on t.id = st.tournament_id
  where st.is_winner = true and st.photo_public = true and st.photo_url is not null
    and t.is_gamezone = true
    and t.closed_at is not null
    and (p_season is null or t.season_id = p_season)
  order by t.tournament_date desc nulls last, st.updated_at desc;
$function$;
