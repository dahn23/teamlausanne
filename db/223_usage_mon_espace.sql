-- 223 — Qui a installé « Mon espace », et qui s'en sert vraiment (05.11.2026).
--
-- Avant le lancement, la console ne savait qu'une chose : « compte créé » / « déjà connecté une fois »
-- (portal_access_list, colonne last_sign_in). Deux limites, et ce sont justement celles qui comptent
-- pour relancer les familles :
--
--   1. last_sign_in_at ne bouge PAS quand on se sert de l'app. Supabase renouvelle le jeton en silence :
--      quelqu'un qui ouvre l'app tous les jours depuis six mois garde la date de son premier mot de passe.
--      Lu de bonne foi, ce champ dit « plus personne ne l'utilise » alors que tout le monde l'utilise.
--   2. Rien ne disait si l'app est INSTALLÉE (Android / iOS / raccourci PWA) ou simplement ouverte dans un
--      navigateur. C'est pourtant la question posée : à qui proposer de la télécharger.
--
-- D'où une table de fréquentation, nourrie par l'app elle-même à chaque ouverture.
--
-- Ce qu'on garde, et pas plus : la DERNIÈRE visite, la plateforme, la date de la 1re ouverture en app
-- installée, et un compteur de JOURS distincts. Pas d'horodatage de chaque ouverture, pas d'écran visité :
-- ce sont des familles et des mineurs, et « s'en sert / ne s'en sert pas » se lit très bien avec ça.
-- (Penser à la page Confidentialité quand l'app s'ouvre au public.)

begin;

create table if not exists public.portal_app_usage (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  last_platform text,                      -- 'web' | 'pwa' | 'android' | 'ios'
  installed_at  timestamptz,               -- 1re ouverture depuis une app INSTALLÉE (jamais effacée ensuite)
  days_used     integer not null default 1 -- jours DISTINCTS d'utilisation, pas les ouvertures
);
-- RLS active SANS policy : personne ne lit cette table en direct. L'app écrit par portal_ping(),
-- la console lit par les deux fonctions ci-dessous, toutes SECURITY DEFINER.
alter table public.portal_app_usage enable row level security;

-- ---- L'app signale son ouverture (appelée par espace.js au démarrage) ----
create or replace function public.portal_ping(p_platform text default 'web')
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pf   text := case when p_platform in ('web', 'pwa', 'android', 'ios') then p_platform else 'web' end;
  v_inst timestamptz := case when v_pf <> 'web' then now() end;
begin
  if auth.uid() is null then return; end if;
  insert into portal_app_usage (user_id, last_platform, installed_at)
  values (auth.uid(), v_pf, v_inst)
  on conflict (user_id) do update set
    -- Le jour se compte à l'heure suisse : sinon une ouverture à 23h30 et une autre à 00h30
    -- comptent pour deux jours l'hiver, et une seule l'été — un compteur qui dépend du fuseau.
    days_used     = portal_app_usage.days_used
                    + case when (portal_app_usage.last_seen_at at time zone 'Europe/Zurich')::date
                              < (now() at time zone 'Europe/Zurich')::date then 1 else 0 end,
    last_seen_at  = now(),
    last_platform = v_pf,
    -- installed_at ne s'efface jamais : ouvrir une fois dans un navigateur ne « désinstalle » rien.
    installed_at  = coalesce(portal_app_usage.installed_at, v_inst);
end $$;
revoke all on function public.portal_ping(text) from public, anon;
grant execute on function public.portal_ping(text) to authenticated;

-- ---- Fréquentation par adresse, pour la liste « Accès Mon espace » ----
create or replace function public.portal_usage_by_email()
returns table(email text, last_seen timestamptz, platform text, installed_at timestamptz, days_used integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire')) then
    raise exception 'non autorisé';
  end if;
  return query
    select lower(u.email), a.last_seen_at, a.last_platform, a.installed_at, a.days_used
    from portal_app_usage a join auth.users u on u.id = a.user_id;
end $$;
revoke all on function public.portal_usage_by_email() from public, anon;
grant execute on function public.portal_usage_by_email() to authenticated;

-- ---- Tout ce que la console sait de l'accès d'UNE fiche ----
-- Les adresses susceptibles d'ouvrir Mon espace pour cette personne, chacune avec son état.
--   source = 'fiche'        : l'e-mail principal de la fiche — le seul qui donne l'accès aujourd'hui ;
--            'lien famille' : l'e-mail du parent/tuteur rattaché par « Liens familiaux » ;
--            'champ parent' : une adresse écrite dans « Parent 1 / Parent 2 ». ⚠ Elle n'ouvre PAS encore
--                             l'accès : c'est l'objet de db/201, écrit mais JAMAIS APPLIQUÉ en base.
--                             On l'affiche quand même, sinon le secrétariat croit la famille injoignable.
create or replace function public.portal_acces_fiche(p uuid)
returns table(email text, source text, has_account boolean, confirme boolean, invited_at timestamptz,
              last_sign_in timestamptz, last_seen timestamptz, platform text,
              installed_at timestamptz, days_used integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff(auth.uid()) then raise exception 'non autorisé'; end if;
  return query
  with cand as (
    select lower(trim(pe.email)) as em, 'fiche'::text as src, 1 as rang
      from people pe where pe.id = p and coalesce(trim(pe.email), '') <> ''
    union all
    select lower(trim(g.email)), 'lien famille', 2
      from guardianships gu join people g on g.id = gu.guardian_id
     where gu.child_id = p and coalesce(trim(g.email), '') <> ''
    union all
    select distinct lower(m[1]), 'champ parent', 3
      from people pe,
           lateral regexp_matches(coalesce(pe.parent1, '') || ' ' || coalesce(pe.parent2, ''),
                                  '([A-Za-z0-9._%+''-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})', 'g') m
     where pe.id = p
  ),
  -- Une même adresse peut arriver par deux chemins (le parent est aussi une fiche liée) :
  -- on garde le plus fort, « fiche » devant « lien famille » devant « champ parent ».
  uniq as (select distinct on (em) em, src from cand order by em, rang)
  select u2.em, u2.src,
         (au.id is not null),
         (au.id is not null and au.email_confirmed_at is not null),
         (select max(i.sent_at) from portal_invites i where lower(i.email) = u2.em),
         au.last_sign_in_at, a.last_seen_at, a.last_platform, a.installed_at, a.days_used
    from uniq u2
    left join auth.users au on lower(au.email) = u2.em
    left join portal_app_usage a on a.user_id = au.id
   order by u2.src, u2.em;
end $$;
revoke all on function public.portal_acces_fiche(uuid) from public, anon;
grant execute on function public.portal_acces_fiche(uuid) to authenticated;

commit;
