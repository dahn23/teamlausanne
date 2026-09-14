-- Newsletter : verrou d'envoi et reprise
--
-- Deux risques que rien n'empêchait :
--
-- 1. Le double envoi. « Envoyer » lisait les destinataires « en_attente » PUIS
--    marquait la newsletter « envoi ». Entre les deux, un second clic — ou un
--    second onglet, ou un rappel de la fonction — lisait la même liste et
--    envoyait une seconde fois. Tout le répertoire recevait le message en
--    double, sans rattrapage possible.
--
-- 2. L'envoi bloqué. Si la fonction mourait en route (temps limite d'une edge
--    function, coupure réseau), le statut restait « envoi » pour toujours : les
--    destinataires restants n'étaient jamais servis et rien ne permettait de
--    reprendre.
--
-- La prise de verrou ci-dessous règle les deux. Elle est atomique : un seul
-- appelant peut passer, parce que le UPDATE ne trouve la ligne qu'une fois.

alter table public.newsletters
  add column if not exists send_started_at timestamptz;

-- Au-delà de ce délai sans nouvelle, un envoi « en cours » est tenu pour mort
-- et peut être repris. Large exprès : mieux vaut attendre qu'envoyer en double.
create or replace function public.newsletter_claim_send(p_id uuid, p_reprendre boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut  text;
  v_depuis  timestamptz;
  v_ok      boolean;
begin
  if not can_newsletter(auth.uid()) then
    return jsonb_build_object('ok', false, 'raison', 'droits');
  end if;

  select status, send_started_at into v_statut, v_depuis
  from newsletters where id = p_id;

  if v_statut is null then
    return jsonb_build_object('ok', false, 'raison', 'introuvable');
  end if;

  -- Une newsletter déjà partie ne repart pas. C'est la protection qui compte
  -- le plus : elle est définitive et ne dépend d'aucun délai.
  if v_statut = 'envoyee' then
    return jsonb_build_object('ok', false, 'raison', 'deja_envoyee');
  end if;

  -- Un envoi en cours et récent : on refuse, sauf reprise explicite d'un envoi
  -- visiblement mort.
  if v_statut = 'envoi'
     and v_depuis is not null
     and v_depuis > now() - interval '15 minutes'
     and not p_reprendre then
    return jsonb_build_object('ok', false, 'raison', 'envoi_en_cours',
                              'depuis', v_depuis);
  end if;

  -- La prise de verrou proprement dite. La clause sur le statut rejoue la
  -- condition : si un autre appelant est passé entre le SELECT et ce UPDATE,
  -- il a mis « envoi » avec un send_started_at frais et nous ne trouvons rien.
  update newsletters
     set status = 'envoi', send_started_at = now(), last_error = null
   where id = p_id
     and status <> 'envoyee'
     and (status <> 'envoi'
          or send_started_at is null
          or send_started_at <= now() - interval '15 minutes'
          or p_reprendre)
  returning true into v_ok;

  if not coalesce(v_ok, false) then
    return jsonb_build_object('ok', false, 'raison', 'envoi_en_cours');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.newsletter_claim_send(uuid, boolean) from public;
grant execute on function public.newsletter_claim_send(uuid, boolean) to authenticated;

-- Un envoi qui se termine mal doit libérer le verrou, sinon il faudrait
-- attendre le délai de reprise pour réessayer.
create or replace function public.newsletter_release_send(p_id uuid, p_erreur text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not can_newsletter(auth.uid()) then return; end if;
  update newsletters
     set status = case when status = 'envoi' then 'erreur' else status end,
         send_started_at = null,
         last_error = coalesce(left(p_erreur, 500), last_error)
   where id = p_id and status = 'envoi';
end;
$$;

revoke all on function public.newsletter_release_send(uuid, text) from public;
grant execute on function public.newsletter_release_send(uuid, text) to authenticated;

-- Les destinataires désinscrits entre le calcul de l'audience et l'envoi.
-- L'audience les exclut déjà au calcul, mais il peut s'écouler plusieurs
-- minutes avant le départ des derniers lots : quelqu'un qui se désinscrit dans
-- cet intervalle recevait quand même le message.
create or replace function public.newsletter_purge_desinscrits(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if not can_newsletter(auth.uid()) then return 0; end if;
  update newsletter_recipients r
     set status = 'desinscrit'
   where r.newsletter_id = p_id
     and r.status = 'en_attente'
     and exists (select 1 from newsletter_unsubscribes u where u.email = r.email);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.newsletter_purge_desinscrits(uuid) from public;
grant execute on function public.newsletter_purge_desinscrits(uuid) to authenticated;
