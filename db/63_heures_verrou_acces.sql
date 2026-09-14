-- Heures et salaires : verrou d'accès
--
-- FUITE CORRIGÉE. staff_hours_month() et coach_hours_detail() étaient
-- SECURITY DEFINER sans le moindre contrôle de droits, et exécutables par
-- « anon » — c'est-à-dire par n'importe qui, sans même être connecté. Un simple
-- appel à l'API REST avec la clé publiable du site renvoyait, pour tout le
-- personnel : nom, heures travaillées, tarif horaire, salaire mensuel, IBAN et
-- ordre permanent. Vérifié avant correction : HTTP 200, 8 coachs et 1 prof.
--
-- Deux verrous sont posés, parce qu'un seul ne suffit pas :
--   1. plus aucun accès sans session (revoke sur anon et public) ;
--   2. un contrôle de rôle DANS la fonction — sans quoi n'importe quel compte
--      connecté, y compris un junior ou un parent, pouvait encore appeler.
--
-- Les corps existants ne sont pas retouchés : ils sont renommés en « _brut »,
-- rendus inaccessibles, et remplacés par une version qui contrôle puis délègue.
-- Moins de risque que de recopier une requête de cette taille.

-- Qui a le droit de voir les heures et salaires de TOUTE l'équipe.
-- Volontairement sans « secretaire » : le secrétariat n'a pas à consulter les
-- rémunérations, et aucun secrétaire ne voyait déjà cet onglet.
create or replace function public.can_hours(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles
     where user_id = uid and role in ('superadmin','admin','head_coach')
  );
$$;

alter function public.staff_hours_month(text)        rename to staff_hours_month_brut;
alter function public.coach_hours_detail(uuid, text) rename to coach_hours_detail_brut;

revoke all on function public.staff_hours_month_brut(text)        from public, anon, authenticated;
revoke all on function public.coach_hours_detail_brut(uuid, text) from public, anon, authenticated;

create or replace function public.staff_hours_month(p_ym text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when can_hours(auth.uid())
              then staff_hours_month_brut(p_ym)
              -- Structure vide mais bien formée : l'interface ne casse pas.
              else jsonb_build_object('coaches', '[]'::jsonb, 'profs', '[]'::jsonb)
         end;
$$;

create or replace function public.coach_hours_detail(p_person uuid, p_ym text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when can_hours(auth.uid())
              then coach_hours_detail_brut(p_person, p_ym)
              else '[]'::jsonb
         end;
$$;

-- my_hours_month ne rend que les heures de l'appelant (auth.uid()), mais elle
-- n'avait aucune raison d'être ouverte à anon non plus.
revoke all on function public.staff_hours_month(text)         from public, anon;
revoke all on function public.coach_hours_detail(uuid, text)  from public, anon;
revoke all on function public.my_hours_month(text)            from public, anon;

grant execute on function public.staff_hours_month(text)        to authenticated;
grant execute on function public.coach_hours_detail(uuid, text) to authenticated;
grant execute on function public.my_hours_month(text)           to authenticated;

-- ---- Retrait d'un onglet à une personne précise ----
-- Les accès de la console sont par rôle. Or un même rôle peut être porté par
-- des gens dont on ne veut pas qu'ils voient la même chose : une monitrice qui
-- travaille aussi au secrétariat garde son rôle de monitrice — donc l'onglet
-- Heures — alors qu'on ne veut pas qu'elle y accède. Ce réglage retire un
-- onglet nominativement, par-dessus les rôles.
--
-- Forme : { "<user_id>": ["heures", …] }  dans app_settings, clé « tab_deny ».
-- Rappel : c'est un confort d'affichage. Ce qui protège réellement les données,
-- ce sont les verrous ci-dessus.
insert into app_settings (key, value)
select 'tab_deny', coalesce(
         (select jsonb_object_agg(u.id::text, jsonb_build_array('heures'))
            from auth.users u
           where u.email in ('rivaroliseline@gmail.com','arsalan_huber@yahoo.com')),
         '{}'::jsonb)
on conflict (key) do update set value = excluded.value;
