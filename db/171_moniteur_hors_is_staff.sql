-- ===================================================================
--  SÉCURITÉ : un moniteur n'est pas l'encadrement (16.10.2026)
-- ===================================================================
-- Constat, mesuré avec le compte d'un vrai moniteur : il pouvait lire 105 des
-- 195 tables et vues du projet. Entre autres :
--
--   mail_messages            6 249  toute la correspondance d'info@
--   mail_attachments         2 968  et ses pièces jointes
--   player_matches          34 586
--   prospects                4 543  le fichier de recrutement
--   prospect_matches         9 237
--   people                   1 225  noms, adresses, e-mails, dates de naissance
--   coach_rates                 22  le tarif horaire de chaque coach
--   gz_salaries                 12  les salaires GameZone
--   out_invoice_payments        28  qui a payé quoi
--   gz_tournament_finance       75
--   contact_messages, person_media, youth_notes, mental_sessions, etudes_*…
--
-- Rien de tout cela n'est proposé par ses écrans. La cause est en un seul
-- endroit : is_staff() inclut 'moniteur', et 110 policies s'appuient sur
-- is_staff(). Côté interface, un moniteur n'a pourtant QUE trois vues —
-- admin.js : `moniteur: ["cours", "social", "heures"]`. La base lui accordait
-- donc les droits du head coach et du secrétariat, alors que l'écran ne lui en
-- montrait rien. Un moniteur curieux, la clé publiable et un navigateur
-- suffisaient.
--
-- CORRECTION, et pourquoi celle-ci plutôt qu'une autre :
--
--  · On ne touche PAS à is_staff(). Le redéfinir changerait d'un coup le sens
--    de 110 policies pour tout le monde — coachs, secrétariat, head coach — et
--    casserait des écrans qu'on ne peut pas tester d'ici.
--
--  · On ajoute is_encadrement() = is_staff MOINS les moniteurs, et on ne
--    repointe que les tables dont un moniteur n'a pas besoin. Table par table,
--    donc relisible, et strictement sans effet pour quiconque n'est pas
--    moniteur : pour tous les autres rôles, is_encadrement() et is_staff()
--    répondent exactement la même chose.
--
--  · On GARDE ce dont vivent ses trois écrans : le planning (courts,
--    réservations, déplacements), les saisons et vacances, la validation de ses
--    cours et de son mois, et people — un moniteur doit pouvoir lire le nom de
--    ses joueurs pour faire l'appel.
--
-- ⚠️ CE QUI RESTE À TRANCHER (hors de ce correctif) : people reste lisible en
-- entier, donc 1 225 fiches avec adresse et e-mail. Le réduire aux seuls
-- joueurs du moniteur est un vrai changement de fonctionnement, pas un
-- verrou : à décider, pas à improviser.

create or replace function public.is_encadrement(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
     and role in ('superadmin','admin','secretaire','head_coach','coach','coach_physique'));
$$;
revoke all on function public.is_encadrement(uuid) from public, anon;
grant execute on function public.is_encadrement(uuid) to authenticated;

comment on function public.is_encadrement(uuid) is
  'is_staff() sans les moniteurs. Pour tout rôle autre que moniteur, répond comme is_staff().';

-- ---- Repointage en masse ------------------------------------------
-- Les tables laissées à is_staff() sont celles dont vivent les écrans d'un
-- moniteur : Cours, Social, Heures. Toutes les autres passent à
-- is_encadrement().
do $$
declare
  garde text[] := array[
    -- Cours / planning : il doit voir sa grille et faire l'appel
    'people', 'role_periods', 'courts', 'court_bookings', 'booking_labels',
    'away_coaches', 'away_events', 'away_players',
    'seasons', 'school_holidays',
    'course_self_report', 'course_validation',
    -- Heures : la validation de son mois
    'staff_month_validation'
  ];
  r record;
  nouveau_qual text; nouveau_check text; sql text;
  n int := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and coalesce(qual, '') || coalesce(with_check, '') like '%is_staff%'
       and not (tablename = any(garde))
     order by tablename, policyname
  loop
    nouveau_qual  := replace(r.qual,       'is_staff(', 'is_encadrement(');
    nouveau_check := replace(r.with_check, 'is_staff(', 'is_encadrement(');
    sql := format('alter policy %I on public.%I', r.policyname, r.tablename);
    if nouveau_qual  is not null then sql := sql || format(' using (%s)', nouveau_qual); end if;
    if nouveau_check is not null then sql := sql || format(' with check (%s)', nouveau_check); end if;
    execute sql;
    n := n + 1;
  end loop;
  raise notice 'Policies repointées vers is_encadrement : %', n;
end $$;

-- ---- coach_rates : son tarif, oui ; celui des autres, non ----------
-- Un coach doit pouvoir vérifier son propre tarif horaire — c'est sa paie.
-- Celui des collègues ne le concerne pas. Le repointage ci-dessus l'a fermé
-- aux moniteurs ; on rouvre la seule ligne qui les regarde.
drop policy if exists coach_rates_self on public.coach_rates;
create policy coach_rates_self on public.coach_rates
  for select using (
    person_id in (select p.person_id from profiles p where p.user_id = auth.uid())
  );
