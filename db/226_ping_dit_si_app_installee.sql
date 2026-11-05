-- 226 — portal_ping() répond désormais « cette personne a-t-elle déjà ouvert
-- l'app installée ? » (05.11.2026)
--
-- Le bandeau « Installez l'application » (db/223 + espace.js) ne se montre que
-- dans un navigateur de téléphone. Il disparaît donc bien UNE FOIS DANS L'APP…
-- mais il revenait dès que la même personne rouvrait app.teamlausanne.ch dans
-- Safari ou Chrome : une page web n'a aucun moyen de savoir qu'une application
-- est installée sur le téléphone. On proposait donc d'installer une app déjà
-- installée — la façon la plus sûre de passer pour un robot insistant.
--
-- La base, elle, le sait déjà : portal_app_usage.installed_at est posé à la
-- première ouverture depuis l'app ou depuis l'écran d'accueil, et le coalesce
-- le garde pour toujours. Il suffisait de le RENDRE.
--
-- portal_ping passe donc de « returns void » à « returns boolean ». Le drop est
-- obligatoire : Postgres refuse de changer le type de retour d'une fonction.
-- Seul espace.js l'appelle (vérifié), et il reçoit toujours la dernière version
-- du fichier, y compris dans la coquille native — rien d'autre à migrer.
--
-- true  = a déjà ouvert l'app installée (ou le raccourci d'écran d'accueil),
--         au moins une fois, sur n'importe quel appareil → ne plus proposer.
-- false = ne l'a jamais fait → le bandeau a du sens.

drop function if exists public.portal_ping(text);

create function public.portal_ping(p_platform text default 'web')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pf   text := case when p_platform in ('web', 'pwa', 'android', 'ios') then p_platform else 'web' end;
  v_inst timestamptz := case when v_pf <> 'web' then now() end;
  v_deja timestamptz;
begin
  if auth.uid() is null then return false; end if;
  insert into portal_app_usage (user_id, last_platform, installed_at)
  values (auth.uid(), v_pf, v_inst)
  on conflict (user_id) do update set
    days_used     = portal_app_usage.days_used
                    + case when (portal_app_usage.last_seen_at at time zone 'Europe/Zurich')::date
                              < (now() at time zone 'Europe/Zurich')::date then 1 else 0 end,
    last_seen_at  = now(),
    last_platform = v_pf,
    installed_at  = coalesce(portal_app_usage.installed_at, v_inst)
  returning installed_at into v_deja;
  return v_deja is not null;
end $$;

revoke all on function public.portal_ping(text) from public, anon;
grant execute on function public.portal_ping(text) to authenticated;
