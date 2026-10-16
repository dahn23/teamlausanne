-- ===================================================================
--  RÉPERTOIRE › Locations de courts, remplies depuis le planning d'hiver
-- ===================================================================
-- Le planning d'hiver (onglet Saison hiver, table winter_plan) contient déjà
-- TOUT : qui occupe quel court, quel jour, à quelle heure, et à quel statut —
-- membre, non-membre, ou gratuit pour les cours de l'académie. 400 cases pour
-- 2026-2027.
--
-- Les Locations de courts, elles, n'avaient que sept créneaux, saisis à la
-- main pour quatre clubs. Les dix-huit autres locataires existaient en fiche
-- mais sans créneau — donc impossibles à facturer depuis Factures ›
-- Abonnements hiver. On recopiait la grille à la main, ou on ne facturait pas.
--
-- Cette fonction déroule la grille en créneaux. Rien n'est inventé : le jour,
-- l'heure, le court et le statut viennent de winter_plan ; le prix de la
-- grille heures pleines / creuses d'app_settings, exactement comme
-- wpPriceOf() dans la console.
--
-- VÉRIFIÉ AVANT D'ÊTRE ÉCRIT. Les quatre clubs déjà saisis à la main servent
-- de témoin : le calcul retrouve leurs montants au franc près, y compris les
-- deux créneaux à cheval sur l'heure creuse —
--   TC Montchoisi vendredi 16:15–19:15 → 950 + 1100 + 1100 = 3150
--   Stade Lausanne vendredi 16:15–20:15 → 950 + 3 × 1100  = 4250
-- Un calcul qui retombe sur des chiffres écrits par quelqu'un d'autre, sur
-- sept cas dont deux non triviaux, n'est pas un calcul au hasard.
--
-- CE QU'ELLE NE FAIT PAS :
--  · Elle n'invente aucun nom. Une case dont le libellé ne correspond à
--    aucune fiche du répertoire est RENVOYÉE dans « inconnus », pas rattachée
--    au plus ressemblant. « Ivan », « Pellaz », « Kids Tennis » ne sont pas
--    des locataires connus : à trancher à la main.
--  · Elle ne lit pas les prix griffonnés dans les libellés. « Geerinckx
--    (500) », « Nathalie Des Termes 850-178=672 », « Pellaz -150 de crédit »
--    annoncent un arrangement que la grille tarifaire ignore. Ces cases sont
--    signalées dans « a_verifier » : le montant calculé est le tarif plein, à
--    corriger si l'arrangement tient.
--  · Elle n'écrit rien tant que p_apply n'est pas vrai.

-- Libellé de case → forme comparable : sans accents, sans ce qui est entre
-- parenthèses, sans les mots qui portent un chiffre (« 850-178=672 », « -150 »).
create or replace function public.wp_nom_norme(p text)
returns text language sql immutable as $$
  select btrim(regexp_replace(
    regexp_replace(
      lower(translate(coalesce(p,''),
        'àáâãäåèéêëìíîïòóôõöùúûüýñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝÑÇ',
        'aaaaaaeeeeiiiiooooouuuuyncAAAAAAEEEEIIIIOOOOOUUUUYNC')),
      '\([^)]*\)|[^a-z /]*[0-9][^ ]*', ' ', 'g'),
    '\s+', ' ', 'g'));
$$;

create or replace function public.winter_rentals_from_plan(
  p_plan_season text default '2026-2027',
  p_season_label text default '2026/27',
  p_apply boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lignes jsonb := '[]'::jsonb; v_inconnus jsonb := '[]'::jsonb; v_verif jsonb := '[]'::jsonb;
  v_n int := 0; v_total numeric := 0;
  r record;
begin
  if not can_billing(auth.uid()) then
    raise exception 'Réservé à la facturation (admin ou pastille finance).';
  end if;

  -- Cases facturables, prix à l'heure, puis îlots d'heures contiguës par
  -- (locataire, jour, court). Un créneau de 15:15 à 21:15 est UNE ligne, pas six.
  for r in
    with prix as (select value as pr from app_settings where key = 'sub_prices'),
         peak as (select value as pk from app_settings where key = 'peak'),
    cases as (
      select w.player_name, w.day, w.court, w.slot, w.status,
             ((select pk from peak) -> w.day::text) @> to_jsonb(8 + w.slot) as pleine
        from winter_plan w
       where w.season = p_plan_season
         and w.status in ('membre', 'normal', 'pre_m')
         and coalesce(w.player_name, '') <> ''
         and w.court <> 'Fitness'
    ),
    avec_prix as (
      select c.*,
             case when c.status in ('membre','pre_m')
                  then case when c.pleine then ((select pr from prix)->>'hiver_membre_pleine')::numeric
                                          else ((select pr from prix)->>'hiver_membre_creuse')::numeric end
                  else case when c.pleine then ((select pr from prix)->>'hiver_nonmembre_pleine')::numeric
                                          else ((select pr from prix)->>'hiver_nonmembre_creuse')::numeric end
             end as prix_h
        from cases c
    ),
    -- Rattachement au répertoire : tous les mots du libellé doivent se
    -- retrouver dans le nom de la fiche (ou l'inverse). « Romeo Franco » et
    -- « Franco Romeo » se rejoignent ; « Ivan » ne rejoint personne.
    relie as (
      select a.*, t.id as tenant_id, t.name as tenant_nom,
             wp_nom_annote(a.player_name) as annote
        from avec_prix a
        left join court_tenants t
          on t.active
         and (
           wp_nom_norme(t.name) = wp_nom_norme(a.player_name)
           or (select bool_and(w = any(string_to_array(wp_nom_norme(t.name), ' ')))
                 from unnest(string_to_array(wp_nom_norme(a.player_name), ' ')) w
                where w <> '')
           or (select bool_and(w = any(string_to_array(wp_nom_norme(a.player_name), ' ')))
                 from unnest(string_to_array(wp_nom_norme(t.name), ' ')) w
                where w <> '')
         )
    ),
    ilots as (
      select *, slot - row_number() over (partition by tenant_id, day, court order by slot) as grp
        from relie where tenant_id is not null
    )
    select tenant_id, tenant_nom, day, court,
           min(slot) as s1, max(slot) as s2, count(*)::int as h,
           sum(prix_h) as montant, bool_or(annote) as annote,
           string_agg(distinct player_name, ' / ') as libelles
      from ilots
     group by tenant_id, tenant_nom, day, court, grp
     order by tenant_nom, day, s1
  loop
    v_n := v_n + 1; v_total := v_total + r.montant;
    v_lignes := v_lignes || jsonb_build_object(
      'locataire', r.tenant_nom, 'jour', r.day, 'court', r.court,
      'de', to_char((8 + r.s1) * interval '1 hour' + interval '15 min', 'HH24:MI'),
      'a',  to_char((9 + r.s2) * interval '1 hour' + interval '15 min', 'HH24:MI'),
      'heures', r.h, 'montant', r.montant);
    if r.annote then
      v_verif := v_verif || jsonb_build_object('locataire', r.tenant_nom,
        'libelle', r.libelles, 'montant_calcule', r.montant);
    end if;
    if p_apply then
      insert into tenant_rentals (tenant_id, season_label, weekday, start_time, end_time,
                                  courts, hours, rate_chf, amount_chf, notes)
      values (r.tenant_id, p_season_label, r.day,
              ((8 + r.s1) * interval '1 hour' + interval '15 min')::time,
              ((9 + r.s2) * interval '1 hour' + interval '15 min')::time,
              r.court, r.h, round(r.montant / nullif(r.h, 0), 2), r.montant,
              'Depuis le planning d''hiver ' || p_plan_season);
    end if;
  end loop;

  -- Les libellés qu'on n'a rattachés à personne. On les NOMME : « 4 cases non
  -- rattachées » obligerait à rouvrir la grille pour les retrouver.
  select coalesce(jsonb_agg(jsonb_build_object('libelle', x.player_name, 'cases', x.n)
           order by x.n desc), '[]'::jsonb) into v_inconnus
    from (
      select w.player_name, count(*) as n
        from winter_plan w
       where w.season = p_plan_season
         and w.status in ('membre','normal','pre_m')
         and coalesce(w.player_name,'') <> ''
         and w.court <> 'Fitness'
         and not exists (
           select 1 from court_tenants t
            where t.active and (
              wp_nom_norme(t.name) = wp_nom_norme(w.player_name)
              or (select bool_and(z = any(string_to_array(wp_nom_norme(t.name), ' ')))
                    from unnest(string_to_array(wp_nom_norme(w.player_name), ' ')) z where z <> '')
              or (select bool_and(z = any(string_to_array(wp_nom_norme(w.player_name), ' ')))
                    from unnest(string_to_array(wp_nom_norme(t.name), ' ')) z where z <> '')))
       group by w.player_name) x;

  return jsonb_build_object('applique', p_apply, 'creneaux', v_n,
    'total_saison', v_total, 'lignes', v_lignes,
    'a_verifier', v_verif, 'inconnus', v_inconnus);
end $$;

revoke all on function public.winter_rentals_from_plan(text, text, boolean) from public, anon;
grant execute on function public.winter_rentals_from_plan(text, text, boolean) to authenticated;

-- Le ménage, pour pouvoir recommencer : ne retire que ce que cette fonction a
-- posé (reconnu à sa note), jamais un créneau saisi à la main.
create or replace function public.winter_rentals_from_plan_clear(
  p_plan_season text default '2026-2027', p_season_label text default '2026/27'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not can_billing(auth.uid()) then
    raise exception 'Réservé à la facturation (admin ou pastille finance).';
  end if;
  delete from tenant_rentals
   where season_label = p_season_label
     and notes = 'Depuis le planning d''hiver ' || p_plan_season;
  get diagnostics n = row_count;
  return jsonb_build_object('supprimes', n);
end $$;
revoke all on function public.winter_rentals_from_plan_clear(text, text) from public, anon;
grant execute on function public.winter_rentals_from_plan_clear(text, text) to authenticated;
