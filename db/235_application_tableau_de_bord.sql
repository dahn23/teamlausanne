-- 235 — Onglet « Application » : le tableau de bord de Mon espace (10.11.2026)
--
-- La console savait déjà QUI a un compte (portal_access_list) et CE QUE chacun
-- fait de l'app (portal_app_usage, db/223). Ce qui manquait, c'est la vue
-- d'ensemble : combien de familles sur combien d'inscrites, la courbe des
-- ouvertures, et ce qui se passe dans l'app au jour le jour.
--
-- Quatre ajouts, et rien de plus :
--
--   A. portal_app_daily — l'historique des ouvertures, JOUR PAR JOUR.
--      db/223 avait sciemment refusé d'horodater chaque ouverture : « ce sont
--      des familles et des mineurs ». On ne revient pas là-dessus. Cette table
--      ne contient donc AUCUNE identité : trois compteurs par jour, et c'est
--      tout. On peut en tirer une courbe, jamais l'emploi du temps de
--      quelqu'un. Conséquence assumée : l'historique commence aujourd'hui,
--      il n'y a rien à reconstituer pour le passé.
--
--   B. portal_ping alimente cette table, à la PREMIÈRE ouverture du jour.
--
--   C. app_stats() — tout l'écran « Statistiques » en UN appel. Les familles
--      y sont comptées PAR ADRESSE et non par enfant : c'est l'adresse qui
--      ouvre un compte, et une fratrie n'en ouvre qu'un.
--
--   D. app_historique() et app_notifications() — ce qui se passe, et ce qui
--      part sur les téléphones.
--
-- app_historique ne crée AUCUN journal nouveau. Tout ce qu'elle montre est
-- déjà horodaté quelque part (absences annoncées, comptes créés, messages,
-- inscriptions, appels faits) : elle ne fait que réunir ces sources, comme
-- agenda_public() réunit les siennes. Rien à instrumenter, rien à maintenir en
-- double, et aucune ligne qui existerait seulement pour ce tableau.

begin;

-- ===================================================================
-- A. L'historique des ouvertures — des COMPTEURS, pas des gens
-- ===================================================================
create table if not exists public.portal_app_daily (
  day      date not null,
  audience text not null,            -- 'famille' | 'encadrement' | 'direction'
  canal    text not null,            -- 'app' (installée) | 'navigateur'
  n        integer not null default 0,
  primary key (day, audience, canal)
);
comment on table public.portal_app_daily is
  'Ouvertures par jour, en nombre seulement. Aucune identité : une personne compte une fois par jour.';

-- RLS active sans policy : comme portal_app_usage, personne ne la lit en
-- direct. portal_ping écrit, app_stats lit, toutes deux SECURITY DEFINER.
alter table public.portal_app_daily enable row level security;

-- ===================================================================
-- B. portal_ping : même contrat qu'en db/226, plus le compteur du jour
-- ===================================================================
-- Le retour (« a déjà ouvert l'app installée ? ») ne change pas : espace.js
-- s'en sert pour ne pas proposer d'installer une app déjà installée.
create or replace function public.portal_ping(p_platform text default 'web')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pf      text := case when p_platform in ('web', 'pwa', 'android', 'ios') then p_platform else 'web' end;
  v_inst    timestamptz := case when v_pf <> 'web' then now() end;
  v_deja    timestamptz;
  v_aujd    date := (now() at time zone 'Europe/Zurich')::date;
  v_dernier date;
  v_premier boolean;
  v_aud     text;
begin
  if auth.uid() is null then return false; end if;

  -- Première ouverture du jour ? La question se pose AVANT l'upsert, qui
  -- écrase last_seen_at. L'heure suisse, comme pour days_used : sinon une
  -- ouverture à 23h30 et une à 00h30 comptent pour deux jours l'hiver et un
  -- seul l'été, et le compteur dépend du fuseau.
  select (a.last_seen_at at time zone 'Europe/Zurich')::date
    into v_dernier from portal_app_usage a where a.user_id = auth.uid();
  v_premier := v_dernier is null or v_dernier < v_aujd;

  insert into portal_app_usage (user_id, last_platform, installed_at)
  values (auth.uid(), v_pf, v_inst)
  on conflict (user_id) do update set
    days_used     = portal_app_usage.days_used + case when v_premier then 1 else 0 end,
    last_seen_at  = now(),
    last_platform = v_pf,
    -- installed_at ne s'efface jamais : ouvrir une fois dans un navigateur ne
    -- « désinstalle » rien.
    installed_at  = coalesce(portal_app_usage.installed_at, v_inst)
  returning installed_at into v_deja;

  if v_premier then
    -- À quel public appartient cette personne. Un coach qui est aussi parent
    -- compte comme encadrement : on cherche « qui ouvre l'app », pas « à quel
    -- titre ». L'ordre est donc volontaire, du plus fort au plus faible.
    select case
      when exists (select 1 from user_roles r where r.user_id = auth.uid()
                     and r.role in ('superadmin', 'admin', 'secretaire', 'responsable')) then 'direction'
      when exists (select 1 from user_roles r where r.user_id = auth.uid()
                     and r.role in ('head_coach', 'senior_coach', 'coach', 'moniteur',
                                    'prof', 'coach_mental', 'coach_physique')) then 'encadrement'
      else 'famille' end
      into v_aud;

    insert into portal_app_daily (day, audience, canal, n)
    values (v_aujd, v_aud, case when v_pf = 'web' then 'navigateur' else 'app' end, 1)
    on conflict (day, audience, canal) do update set n = portal_app_daily.n + 1;
  end if;

  return v_deja is not null;
end $$;
revoke all on function public.portal_ping(text) from public, anon;
grant execute on function public.portal_ping(text) to authenticated;

-- ===================================================================
-- C1. app_stats — tout l'écran « Statistiques » en un appel
-- ===================================================================
-- Un seul aller-retour, et un seul endroit où la règle est écrite. Les
-- familles sont comptées PAR ADRESSE et non par enfant : c'est l'adresse qui
-- ouvre un compte, et une fratrie n'en ouvre qu'un.
create or replace function public.app_stats(p_jours integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_j     integer := greatest(1, least(coalesce(p_jours, 30), 400));
  v_depuis timestamptz := now() - make_interval(days => v_j);
  v_out   jsonb;
begin
  if not (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire')) then
    raise exception 'non autorisé';
  end if;

  with saison as (
    select s.id from seasons s
     where s.kind = 'juniors' and current_date between s.start_date and s.end_date
     limit 1
  ),
  -- Les adresses inscrites cette saison, toutes filières confondues : c'est le
  -- dénominateur de l'adoption. Une adresse = une famille.
  insc as (
    select lower(trim(pe.email)) em
      from people pe
      join role_periods rp on rp.person_id = pe.id
      join saison sa on sa.id = rp.season_id
     where coalesce(trim(pe.email), '') <> ''
     group by 1
  ),
  fam as (
    select i.em, au.id uid, au.created_at, au.email_confirmed_at,
           a.last_seen_at, a.installed_at, a.days_used
      from insc i
      left join auth.users au on lower(au.email) = i.em
      left join portal_app_usage a on a.user_id = au.id
  ),
  -- Le personnel, par rôle réel. Même découpage que portal_ping.
  staff as (
    select u.id uid,
           case when exists (select 1 from user_roles r where r.user_id = u.id
                               and r.role in ('superadmin', 'admin', 'secretaire', 'responsable')) then 'direction'
                when exists (select 1 from user_roles r where r.user_id = u.id
                               and r.role in ('head_coach', 'senior_coach', 'coach', 'moniteur',
                                              'prof', 'coach_mental', 'coach_physique')) then 'encadrement'
                else 'famille' end aud,
           a.last_seen_at, a.installed_at
      from auth.users u
      left join portal_app_usage a on a.user_id = u.id
  ),
  -- La courbe. generate_series pour que les jours sans ouverture vaillent
  -- zéro : sans cela la grille se resserre et laisse croire à une régularité
  -- qui n'existe pas.
  jours as (
    select d::date jour
      from generate_series((now() at time zone 'Europe/Zurich')::date - (v_j - 1),
                           (now() at time zone 'Europe/Zurich')::date, interval '1 day') d
  )
  select jsonb_build_object(
    'jours', v_j,
    'familles', (select jsonb_build_object(
        'saison',       count(*),
        'comptes',      count(uid),
        'confirmes',    count(*) filter (where email_confirmed_at is not null),
        'installee',    count(*) filter (where installed_at is not null),
        'actives',      count(*) filter (where last_seen_at >= v_depuis),
        'nouveaux',     count(*) filter (where created_at >= v_depuis),
        'jours_moyens', coalesce(round(avg(days_used) filter (where last_seen_at >= v_depuis), 1), 0)
      ) from fam),
    'encadrement', (select jsonb_build_object(
        'total',     count(*),
        'vus',       count(*) filter (where last_seen_at >= v_depuis),
        'installee', count(*) filter (where installed_at is not null)
      ) from staff where aud = 'encadrement'),
    'direction', (select jsonb_build_object(
        'total',     count(*),
        'vus',       count(*) filter (where last_seen_at >= v_depuis),
        'installee', count(*) filter (where installed_at is not null)
      ) from staff where aud = 'direction'),
    -- Les téléphones qui reçoivent les notifications (db push_devices).
    'telephones', (select count(*) from push_devices),
    'absences', (select count(*) from course_notices
                  where kind = 'absent' and via = 'portail' and created_at >= v_depuis),
    'retards',  (select count(*) from course_notices
                  where kind = 'retard' and via = 'portail' and created_at >= v_depuis),
    -- Depuis quand le relevé existe. Affiché sous la courbe : sans cette date,
    -- un mois vide se lit « personne n'ouvre l'app » au lieu de « on ne
    -- comptait pas encore ».
    'depuis', (select min(day) from portal_app_daily),
    -- Deux étages : on agrège d'abord PAR JOUR, puis on empile les jours.
    -- Un seul étage avec group by rendrait une ligne par jour là où il faut
    -- une valeur unique, et la fonction refuserait de se compiler.
    'ouvertures', (select coalesce(jsonb_agg(z.o order by z.jour), '[]'::jsonb) from (
        select j.jour, jsonb_build_object(
                 'jour',        j.jour,
                 'famille_app', coalesce(sum(d.n) filter (where d.audience = 'famille' and d.canal = 'app'), 0),
                 'famille_web', coalesce(sum(d.n) filter (where d.audience = 'famille' and d.canal = 'navigateur'), 0),
                 'encadrement', coalesce(sum(d.n) filter (where d.audience = 'encadrement'), 0),
                 'direction',   coalesce(sum(d.n) filter (where d.audience = 'direction'), 0)) o
          from jours j left join portal_app_daily d on d.day = j.jour
         group by j.jour) z),
    -- Les dernières ouvertures, nommées. C'est la seule partie de l'écran qui
    -- désigne des personnes : elle sert à rappeler une famille, donc il faut
    -- un nom. Elle lit portal_app_usage (la dernière visite), pas la table
    -- des compteurs.
    'dernieres', (select coalesce(jsonb_agg(jsonb_build_object(
          'nom', s.nom, 'enfants', s.enfants, 'quand', s.quand,
          'canal', s.canal, 'public', s.pub)
        order by s.quand desc), '[]'::jsonb) from (
        select coalesce(nullif(trim(pe.first_name || ' ' || pe.last_name), ''), u.email) nom,
               (select string_agg(distinct k.first_name, ', ')
                  from people k where lower(trim(k.email)) = lower(u.email)) enfants,
               a.last_seen_at quand,
               case when a.installed_at is not null then 'app' else 'navigateur' end canal,
               -- Le public, pour que la liste ne fasse pas passer un coach
               -- pour une famille : les trois se mêlent dans les ouvertures.
               st.aud pub
          from portal_app_usage a
          join auth.users u on u.id = a.user_id
          join staff st on st.uid = a.user_id
          left join lateral (select p2.first_name, p2.last_name from people p2
                              where lower(trim(p2.email)) = lower(u.email)
                              order by p2.birthdate nulls first limit 1) pe on true
         order by a.last_seen_at desc
         limit 12) s)
  ) into v_out;

  return v_out;
end $$;
revoke all on function public.app_stats(integer) from public, anon;
grant execute on function public.app_stats(integer) to authenticated;

-- ===================================================================
-- C2. app_historique — ce qui s'est passé dans l'app
-- ===================================================================
-- Réunion de sources DÉJÀ horodatées. Aucune table nouvelle : si une ligne
-- apparaît ici, c'est qu'elle existe ailleurs pour une vraie raison.
--   qui = 'famille'     : ce que font les familles depuis Mon espace ;
--         'encadrement' : ce que font les coachs et profs depuis la console ;
--         'tout'        : les deux.
create or replace function public.app_historique(p_jours integer default 30,
                                                 p_qui text default 'tout')
returns table(quand timestamptz, qui text, acteur text, action text, detail text, source text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_j      integer := greatest(1, least(coalesce(p_jours, 30), 400));
  v_depuis timestamptz := now() - make_interval(days => v_j);
begin
  if not (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire')) then
    raise exception 'non autorisé';
  end if;
  return query
  with evts as (
    -- Une famille annonce une absence ou un retard, depuis Mon espace.
    select n.created_at as q, 'famille'::text as w,
           coalesce(nullif(trim(pe.first_name || ' ' || pe.last_name), ''), 'Une famille') as a,
           case when n.kind = 'absent' then 'absence annoncée' else 'retard annoncé' end as ac,
           -- concat_ws et non une concaténation : sans titre de cours, un
           -- simple || laissait la ligne commencer par un séparateur orphelin.
           concat_ws(' — ', nullif(coalesce(nullif(c.title, ''), ct.name, ''), ''),
                            nullif(n.note, '')) as de,
           'Mon espace'::text as so
      from course_notices n
      left join people pe on pe.id = n.person_id
      left join courses c on c.id = n.course_id
      left join course_types ct on ct.id = c.course_type_id
     where n.via = 'portail' and n.created_at >= v_depuis
    union all
    -- Un compte s'ouvre : la famille est entrée dans l'app.
    select p.created_at, 'famille',
           coalesce(nullif(trim(pe.first_name || ' ' || pe.last_name), ''), 'Nouveau compte'),
           'compte créé', '', 'Mon espace'
      from profiles p
      left join people pe on pe.id = p.person_id
     where p.created_at >= v_depuis
    union all
    -- Un message envoyé par le formulaire de contact (site ou Mon espace).
    select m.created_at, 'famille', coalesce(nullif(trim(m.name), ''), m.email),
           'message envoyé', coalesce(m.source, ''), 'Messagerie'
      from contact_messages m
     where m.created_at >= v_depuis
    union all
    -- Une demande d'inscription venue des pages de filière du site.
    select e.created_at, 'famille', trim(e.first_name || ' ' || e.last_name),
           'demande d''inscription', coalesce(e.filiere, ''), 'Site public'
      from enrollment_requests e
     where e.created_at >= v_depuis
    union all
    -- Une inscription à un stage.
    select r.created_at, 'famille', trim(r.first_name || ' ' || r.last_name),
           'inscription à un stage', coalesce(st.title, ''), 'Site public'
      from stage_registrations r
      left join stage_sessions st on st.id = r.stage_id
     where r.created_at >= v_depuis
    union all
    -- Un coach fait l'appel. Une ligne par cours, pas une par élève : sinon
    -- un cours de huit remplit l'écran à lui tout seul.
    select max(a2.marked_at), 'encadrement',
           coalesce(nullif(trim(pe.first_name || ' ' || pe.last_name), ''), 'Un coach'),
           'appel fait',
           concat_ws(' · ', nullif(coalesce(nullif(c.title, ''), ct.name, ''), ''),
                            count(*) filter (where a2.status = 'present') || ' présent(s), '
                            || count(*) filter (where a2.status <> 'present') || ' absent(s)'),
           'Console'
      from attendance a2
      join courses c on c.id = a2.course_id
      left join course_types ct on ct.id = c.course_type_id
      left join profiles pr on pr.user_id = a2.marked_by
      left join people pe on pe.id = pr.person_id
     where a2.marked_at >= v_depuis
     group by a2.course_id, c.title, ct.name, pe.first_name, pe.last_name
  )
  select e.q, e.w, e.a, e.ac, e.de, e.so from evts e
   where p_qui is null or p_qui = 'tout' or e.w = p_qui
   order by e.q desc
   limit 300;
end $$;
revoke all on function public.app_historique(integer, text) from public, anon;
grant execute on function public.app_historique(integer, text) to authenticated;

-- ===================================================================
-- D2. app_notifications — les téléphones abonnés et ce qui leur part
-- ===================================================================
-- push_devices n'est lisible que par son propriétaire (policy pd_own) et
-- push_queue n'a aucune policy : la console ne peut pas les lire en direct.
create or replace function public.app_notifications()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_out jsonb;
begin
  if not (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire')) then
    raise exception 'non autorisé';
  end if;
  select jsonb_build_object(
    'appareils', (select coalesce(jsonb_agg(jsonb_build_object(
          'nom', x.nom, 'plateforme', x.plateforme, 'depuis', x.depuis, 'vu', x.vu)
        order by x.depuis), '[]'::jsonb) from (
        select coalesce(nullif(trim(pe.first_name || ' ' || pe.last_name), ''), u.email) nom,
               d.platform plateforme, d.created_at depuis, d.last_seen_at vu
          from push_devices d
          join auth.users u on u.id = d.user_id
          left join profiles pr on pr.user_id = d.user_id
          left join people pe on pe.id = pr.person_id) x),
    'envois', (select coalesce(jsonb_agg(jsonb_build_object(
          'titre', y.titre, 'corps', y.corps, 'genre', y.genre,
          'quand', y.quand, 'parti', y.parti)
        order by y.quand desc), '[]'::jsonb) from (
        select q.title titre, q.body corps, q.kind genre,
               q.created_at quand, (q.sent_at is not null) parti
          from push_queue q
         order by q.created_at desc limit 25) y)
  ) into v_out;
  return v_out;
end $$;
revoke all on function public.app_notifications() from public, anon;
grant execute on function public.app_notifications() to authenticated;

commit;
