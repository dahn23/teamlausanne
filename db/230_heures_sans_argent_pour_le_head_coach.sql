-- 230 — Heures : le head coach ne reçoit plus tarif, montant ni IBAN (06.11.2026)
--
-- Ce qu'on croyait, et qui était faux. L'onglet Heures cache ses colonnes
-- « Extra », « Net à payer » et « Payé » derrière canSalaries() (admin, ou
-- étiquette « paie »), et on en concluait que l'argent était protégé. Il ne
-- l'était pas : TARIF HORAIRE, MONTANT DÛ et IBAN sont trois colonnes
-- ordinaires, visibles de tout isManager — dont le head coach. Et surtout,
-- staff_hours_month() les ENVOYAIT dans le navigateur de tout le monde.
--
-- Mesuré le 06.11.2026 sur le mois d'octobre, avec le compte de Mariano
-- Palena (head coach) : 24 lignes de personnel, dont 23 IBAN, 19 tarifs
-- horaires, 5 salaires mensuels et 5 ordres permanents.
--
-- Masquer une colonne en CSS n'est pas une protection : la donnée est déjà
-- partie. On la retire donc de la RÉPONSE. can_hours() continue de décider
-- qui voit le décompte de l'équipe (admin, superadmin, head coach) ;
-- can_payroll() décide seul qui en voit l'argent (admin, superadmin, ou
-- l'étiquette CRM « paie »).
--
-- Ce que le head coach garde : nom, heures, cours faits / prévus, camps, et
-- les pastilles « compensé » / « sur facture ». De quoi suivre le travail de
-- l'équipe, ce qui est son métier, sans la paie, qui ne l'est pas.
--
-- Décision de Raphael, 06.11.2026. Le pendant d'interface est la classe
-- .pay-col dans admin.html / admin.js, cachée avec .sal-col — mise en page
-- seulement, la protection est ici.

create or replace function public.staff_hours_month(p_ym text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with brut as (
    select case when can_hours(auth.uid())
                then staff_hours_month_brut(p_ym)
                -- Structure vide mais bien formée : l'interface ne casse pas.
                else jsonb_build_object('coaches', '[]'::jsonb, 'profs', '[]'::jsonb)
           end as j
  ),
  -- Ce qui relève de la PAIE et non des heures.
  net as (
    select jsonb_build_object(
      'coaches', coalesce((select jsonb_agg(e - 'iban' - 'rate' - 'salary' - 'standing_order' - 'stage_fee' - 'extra')
                             from jsonb_array_elements(j->'coaches') e), '[]'::jsonb),
      'profs',   coalesce((select jsonb_agg(e - 'iban' - 'rate' - 'salary' - 'standing_order' - 'stage_fee' - 'extra')
                             from jsonb_array_elements(j->'profs') e), '[]'::jsonb)
    ) as j
    from brut
  )
  select case when can_payroll(auth.uid()) then (select j from brut) else (select j from net) end;
$$;

-- Vérification (à rejouer tel quel) : le head coach ne doit avoir aucune de
-- ces clés, l'admin doit les avoir toutes.
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<user_id>","role":"authenticated"}';
--   with r as (select staff_hours_month('2026-10') as j),
--   e as (select jsonb_array_elements(j->'coaches') c from r
--         union all select jsonb_array_elements(j->'profs') from r)
--   select count(*) lignes, count(*) filter (where e.c ? 'iban') iban,
--          count(*) filter (where e.c ? 'rate') tarif,
--          count(*) filter (where e.c ? 'salary') salaire from e;
--   rollback;
--
-- Relevé le 06.11.2026 : Mariano (head coach) 24 lignes / 0 / 0 / 0 ;
--                        Dan (superadmin)     24 lignes / 23 / 19 / 5.
