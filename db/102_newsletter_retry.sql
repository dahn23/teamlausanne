-- Relancer les envois en erreur d'une newsletter déjà partie (ex. quota Resend dépassé, 25.09.2026).
-- Remet les destinataires « erreur » en attente et prend le verrou d'envoi ; la console appelle ensuite
-- newsletter-send (reprendre) qui n'envoie QUE les « en_attente » : les déjà servis ne reçoivent rien de plus.
create or replace function public.newsletter_retry_failed(p_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare v_statut text; v_n integer;
begin
  if not can_newsletter(auth.uid()) then raise exception 'droits'; end if;
  select status into v_statut from newsletters where id = p_id for update;
  if v_statut is null then raise exception 'introuvable'; end if;
  if v_statut <> 'envoyee' then raise exception 'la newsletter n''est pas dans l''état « envoyée » (%)', v_statut; end if;
  update newsletter_recipients set status = 'en_attente', error = null where newsletter_id = p_id and status = 'erreur';
  get diagnostics v_n = row_count;
  if v_n > 0 then
    update newsletters set status = 'envoi', send_started_at = now(), last_error = null where id = p_id;
  end if;
  return v_n;
end $$;
revoke all on function public.newsletter_retry_failed(uuid) from public, anon;
grant execute on function public.newsletter_retry_failed(uuid) to authenticated;

-- v2 (25.09.2026) : relance aussi une newsletter restée « erreur » avec des destinataires en attente
-- (remise en état manuelle par une autre session) ; le bouton se base sur newsletter_pending_counts().
create or replace function public.newsletter_retry_failed(p_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare v_statut text; v_n integer;
begin
  if not can_newsletter(auth.uid()) then raise exception 'droits'; end if;
  select status into v_statut from newsletters where id = p_id for update;
  if v_statut is null then raise exception 'introuvable'; end if;
  if v_statut not in ('envoyee', 'erreur') then raise exception 'la newsletter n''est ni envoyée ni en erreur (%)', v_statut; end if;
  update newsletter_recipients set status = 'en_attente', error = null where newsletter_id = p_id and status = 'erreur';
  select count(*) into v_n from newsletter_recipients where newsletter_id = p_id and status = 'en_attente';
  if v_n > 0 then
    update newsletters set status = 'envoi', send_started_at = now(), last_error = null where id = p_id;
  end if;
  return v_n;
end $$;
create or replace function public.newsletter_pending_counts() returns table(newsletter_id uuid, n bigint)
language sql stable security definer set search_path = public as $$
  select r.newsletter_id, count(*) from newsletter_recipients r join newsletters n on n.id = r.newsletter_id
   where can_newsletter(auth.uid()) and n.status in ('envoyee', 'erreur') and r.status in ('erreur', 'en_attente')
   group by r.newsletter_id;
$$;
revoke all on function public.newsletter_pending_counts() from public, anon;
grant execute on function public.newsletter_pending_counts() to authenticated;
