-- ===================================================================
--  Locations de courts : l'ajustement qui survit à une régénération
-- ===================================================================
-- db/177 déroule le planning d'hiver en créneaux facturables, et le relancer
-- REMPLACE les lignes du locataire. Très bien tant que tout vient du calcul —
-- mais le secrétariat négocie : « Pellaz -150 de crédit », « Geerinckx (500) »,
-- « Nathalie Des Termes 850-178=672 » sont écrits à même les cases du planning.
--
-- Corriger le montant à la main ne tiendrait pas : la prochaine régénération
-- l'écraserait avec le tarif plein, sans rien dire. L'écart se range donc dans
-- sa propre colonne, et le générateur le REPORTE sur la ligne qu'il recrée.
--
-- Le tarif reste donc le tarif, l'arrangement reste l'arrangement, et les deux
-- se lisent séparément — c'est ce qui permet de répondre « 1100, moins 150 de
-- crédit » plutôt que « 950, je ne sais plus pourquoi ».

alter table tenant_rentals
  add column if not exists ajustement_chf numeric,
  add column if not exists ajustement_motif text;

comment on column tenant_rentals.ajustement_chf is
  'Écart négocié par rapport au tarif (négatif = remise). Reporté par winter_rentals_from_plan lors d''une régénération.';

-- Le générateur, avec report des ajustements. Seule la partie « remplacer »
-- change : on relève les ajustements avant de supprimer, on les repose après
-- avoir réinséré, en se repérant sur le créneau (jour, heure de début, court).
create or replace function public.winter_rentals_from_plan(
  p_plan_season text default '2026-2027',
  p_season_label text default '2026/27',
  p_apply boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lignes jsonb := '[]'::jsonb; v_inconnus jsonb := '[]'::jsonb; v_verif jsonb := '[]'::jsonb;
  v_n int := 0; v_total numeric := 0; v_remplaces int := 0; v_reportes int := 0;
  r record;
begin
  if not can_billing(auth.uid()) then
    raise exception 'Réservé à la facturation (admin ou pastille finance).';
  end if;

  drop table if exists _gen;
  create temp table _gen on commit drop as
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
  relie as (
    select a.*, t.id as tenant_id, t.name as tenant_nom,
           wp_nom_annote(a.player_name) as annote
      from avec_prix a
      left join court_tenants t
        on t.active
       and (
         wp_nom_norme(t.name) = wp_nom_norme(a.player_name)
         or (select bool_and(w = any(string_to_array(wp_nom_norme(t.name), ' ')))
               from unnest(string_to_array(wp_nom_norme(a.player_name), ' ')) w where w <> '')
         or (select bool_and(w = any(string_to_array(wp_nom_norme(a.player_name), ' ')))
               from unnest(string_to_array(wp_nom_norme(t.name), ' ')) w where w <> '')
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
   group by tenant_id, tenant_nom, day, court, grp;

  if p_apply then
    -- Les arrangements déjà pris, mis de côté le temps de refaire les lignes.
    drop table if exists _ajust;
    create temp table _ajust on commit drop as
      select tr.tenant_id, tr.weekday, tr.start_time, tr.courts,
             tr.ajustement_chf, tr.ajustement_motif
        from tenant_rentals tr
       where tr.season_label = p_season_label
         and tr.ajustement_chf is not null
         and tr.tenant_id in (select distinct g.tenant_id from _gen g);

    delete from tenant_rentals tr
     where tr.season_label = p_season_label
       and tr.tenant_id in (select distinct g.tenant_id from _gen g);
    get diagnostics v_remplaces = row_count;
  end if;

  for r in select * from _gen order by tenant_nom, day, s1 loop
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

  -- On repose les arrangements, et le montant les reprend. Le tarif calculé
  -- reste lisible dans rate_chf × hours : on sait toujours d'où vient l'écart.
  if p_apply then
    update tenant_rentals tr
       set ajustement_chf = a.ajustement_chf,
           ajustement_motif = a.ajustement_motif,
           amount_chf = tr.amount_chf + a.ajustement_chf
      from _ajust a
     where tr.season_label = p_season_label
       and tr.tenant_id = a.tenant_id and tr.weekday = a.weekday
       and tr.start_time = a.start_time and tr.courts = a.courts;
    get diagnostics v_reportes = row_count;
  end if;

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
    'total_saison', v_total, 'remplaces', v_remplaces, 'ajustements_reportes', v_reportes,
    'lignes', v_lignes, 'a_verifier', v_verif, 'inconnus', v_inconnus);
end $$;
