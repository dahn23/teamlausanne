-- ===================================================================
--  SÉCURITÉ : un coach voit ses cours, et rien d'autre (16.10.2026)
-- ===================================================================
-- Demande explicite : « ils doivent voir leurs cours, les enfants de leurs
-- cours, pouvoir valider comme ils l'ont toujours fait, mais surtout rien
-- d'autre. »
--
-- Ce n'était pas le cas, et ne l'a jamais été : mesuré avec un compte coach
-- ordinaire, il lisait encore 2 734 entrées GameZone, 1 880 présences
-- d'Études, les finances de 75 tournois, les salaires GameZone, les 21
-- séances de coaching mental, 115 médias de joueurs, les 71 cartes du
-- tableau de bord interne, les locataires de courts, les produits de
-- facturation, le journal d'opérations… Aucun de ces écrans ne lui est
-- proposé : la matrice d'admin.js donne au coach cours, social, matchs,
-- lastscores, plantournois, phystests, physique, heures. Ni GameZone, ni
-- Études, ni Mental, ni Stages, ni Répertoire.
--
-- Ce fichier ferme chaque DOMAINE sur les rôles qui en ont l'onglet. Les
-- prédicats sont nommés d'après l'onglet, pour qu'on puisse relire la matrice
-- et la base côte à côte sans traduire.
--
-- Ce qui reste ouvert au coach, et c'est voulu : le planning et ses cours,
-- les feuilles de match, les tests physiques, le planning tournois, le social,
-- ses heures — les onglets qu'il a. La restriction de people / présences /
-- participants à SES cours vient dans le fichier suivant.

-- ---- Les portes, une par onglet ------------------------------------
create or replace function public.can_gamezone(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
     and role in ('superadmin','admin','secretaire','organisateur','responsable','gz_lecture'))
      or is_gz_official(uid);
$$;

create or replace function public.can_etudes(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
     and role in ('superadmin','admin','head_coach','prof'));
$$;

create or replace function public.can_mental(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
     and role in ('superadmin','admin','head_coach','coach_mental'));
$$;

create or replace function public.can_stages(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
     and role in ('superadmin','admin','secretaire','head_coach'));
$$;

-- Répertoire : la fiche d'une personne, ses liens parents, ses médias, ses
-- rôles. C'est le cœur des données personnelles du club.
create or replace function public.can_membres(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
     and role in ('superadmin','admin','secretaire','head_coach'));
$$;

create or replace function public.can_interne(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
     and role in ('superadmin','admin','secretaire'));
$$;

do $$
declare f text;
begin
  foreach f in array array['can_gamezone','can_etudes','can_mental','can_stages',
                           'can_membres','can_interne']
  loop
    execute format('revoke all on function public.%I(uuid) from public, anon', f);
    execute format('grant execute on function public.%I(uuid) to authenticated', f);
  end loop;
end $$;

-- ---- Repointage par domaine ----------------------------------------
-- Chaque table va à la porte de son onglet. On remplace is_staff( et
-- is_encadrement( — selon ce que db/171 y a laissé — par le prédicat visé.
do $$
declare
  plan jsonb := jsonb_build_object(
    'can_gamezone', jsonb_build_array(
      'gz_caisse','gz_config','gz_email_templates','gz_entries','gz_link_review',
      'gz_managers','gz_participants','gz_payments','gz_player_status',
      'gz_price_categories','gz_salaries','gz_seasons','gz_survey_answers',
      'gz_survey_questions','gz_survey_responses','gz_surveys','gz_tournaments',
      'gz_weekend_settlements'),
    'can_etudes', jsonb_build_array(
      'etudes_attendance','etudes_day_profs','etudes_day_validation','etudes_days',
      'etudes_remarks'),
    'can_mental', jsonb_build_array('mental_comments','mental_sessions','youth_notes'),
    'can_stages', jsonb_build_array(
      'stage_categories','stage_email_templates','stage_link_review','stage_mail_sent',
      'stage_registrations','stage_session_categories','stage_sessions','stage_staff'),
    'can_membres', jsonb_build_array(
      'guardianships','person_media','person_objectives','person_roles','plz_geo',
      'suivi_contacts','enrollment_requests'),
    'can_interne', jsonb_build_array(
      'pm_attachments','pm_card_labels','pm_card_members','pm_cards','pm_checklist',
      'pm_columns','pm_labels','pm_members','news','news_articles','ops_log',
      'coach_meal_defaults','lock_codes','lock_events','locks','irrigation_zones',
      'watering_events','watering_schedules'),
    'can_billing', jsonb_build_array(
      'invoice_products','court_tenants','tenant_rentals','wallet_ledger')
  );
  porte text; tbl text; r record; q text; c text; sql text; n int := 0;
begin
  for porte in select jsonb_object_keys(plan) loop
    for tbl in select jsonb_array_elements_text(plan -> porte) loop
      for r in
        select policyname, qual, with_check from pg_policies
         where schemaname = 'public' and tablename = tbl
           and coalesce(qual,'') || coalesce(with_check,'') ~ '(is_staff|is_encadrement)\('
      loop
        q := regexp_replace(r.qual,       '(is_staff|is_encadrement)\(', porte || '(', 'g');
        c := regexp_replace(r.with_check, '(is_staff|is_encadrement)\(', porte || '(', 'g');
        sql := format('alter policy %I on public.%I', r.policyname, tbl);
        if q is not null then sql := sql || format(' using (%s)', q); end if;
        if c is not null then sql := sql || format(' with check (%s)', c); end if;
        execute sql;
        n := n + 1;
      end loop;
    end loop;
  end loop;
  raise notice 'Policies repointées par domaine : %', n;
end $$;

-- ---- Les vues GameZone -------------------------------------------
-- Elles lisent des tables désormais fermées, mais une vue traverse la RLS si
-- elle n'est pas en security_invoker (cf. db/169) : sans cela le verrou
-- ci-dessus ne servirait à rien.
do $$
declare v text;
begin
  foreach v in array array['gz_participant_stats','gz_participant_season_stats',
                           'gz_tournament_counts','gz_tournament_finance']
  loop
    if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                where n.nspname='public' and c.relname = v and c.relkind='v') then
      execute format('alter view public.%I set (security_invoker = on)', v);
    end if;
  end loop;
end $$;
