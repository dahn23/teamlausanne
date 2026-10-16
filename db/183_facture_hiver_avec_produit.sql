-- ===================================================================
--  FACTURES › Abonnements hiver : dire ce qu'on a vendu (16.10.2026)
-- ===================================================================
-- La facture d'un locataire listait ses créneaux — « Mercredi 15:15–21:15 ·
-- courts 4 » — et un montant. Juste, mais muet sur le PRODUIT : impossible de
-- savoir, en relisant la facture, si ces six heures étaient de l'heure pleine
-- ou de l'heure creuse, au tarif membre ou non-membre. Et out_invoices.product_id
-- restait vide, donc ces factures échappaient au filtre par produit, au
-- contrôle de cohérence et aux pastilles de l'onglet Relances.
--
-- Chaque ligne nomme désormais son produit, et un créneau à cheval sur l'heure
-- creuse se scinde en deux lignes — c'est la seule façon d'écrire une facture
-- dont le total se refait de tête :
--
--   Abonnement hiver — non-membre · heure creuse — Vendredi 16:15–17:15 · court 5 (1 h)    950.00
--   Abonnement hiver — non-membre · heure pleine — Vendredi 17:15–19:15 · court 5 (2 h)  2 200.00
--
-- L'ARRANGEMENT A SA PROPRE LIGNE. Un crédit négocié fondu dans le prix d'une
-- heure donne une facture que la famille ne peut pas vérifier, et un tarif
-- qu'on ne reconnaît plus l'année suivante. « Arrangement convenu −150.00 »
-- se lit, se discute, et laisse le tarif intact au-dessus.
--
-- Le total ne bouge pas : il reste la somme des amount_chf des créneaux, donc
-- exactement ce qu'affiche l'écran Abonnements hiver. Les lignes par tarif
-- plus la ligne d'arrangement retombent dessus par construction.

create or replace function public.tenant_invoice_create(
  p_tenant uuid, p_season_label text, p_due date default null::date)
returns table(inv_id uuid, inv_number text, inv_amount numeric)
language plpgsql security definer set search_path = public as $function$
declare
  t public.court_tenants%rowtype;
  r public.tenant_rentals%rowtype;
  v_num text; v_id uuid; v_total numeric := 0;
  v_items jsonb := '[]'::jsonb; v_nom text; v_rue text; v_npa text; v_ville text; v_mail text;
  v_membre boolean; v_pr jsonb; v_pk jsonb;
  v_jour text; v_h int; v_pleine boolean; v_prix numeric;
  v_nb_c int; v_nb_p int; v_nc int;
  v_prod_c uuid; v_prod_p uuid; v_nom_c text; v_nom_p text;
  v_dom uuid; v_dom_montant numeric := 0;
begin
  if not can_billing(auth.uid()) then raise exception 'Accès refusé'; end if;

  select * into t from court_tenants ct where ct.id = p_tenant;
  if not found then raise exception 'Locataire introuvable'; end if;

  v_nom := t.name; v_rue := t.address; v_npa := t.postal_code;
  v_ville := t.city; v_mail := t.contact_email;
  if t.person_id is not null then
    select coalesce(nullif(btrim(pe.first_name || ' ' || pe.last_name), ''), t.name),
           coalesce(t.address, pe.address), coalesce(t.postal_code, pe.postal_code),
           coalesce(t.city, pe.city), coalesce(t.contact_email, pe.email)
      into v_nom, v_rue, v_npa, v_ville, v_mail
      from people pe where pe.id = t.person_id;
  end if;

  -- Un club ou un externe paie le tarif non-membre. Même règle que le planning
  -- d'hiver, qui range ses cases en « membre » ou « normal ».
  v_membre := (t.kind = 'membre');
  select value into v_pr from app_settings where key = 'sub_prices';
  select value into v_pk from app_settings where key = 'peak';

  select ip.id, ip.name into v_prod_c, v_nom_c from invoice_products ip
   where ip.kind = 'location'
     and ip.name = 'Abonnement hiver — ' || case when v_membre then 'membre' else 'non-membre' end || ' · heure creuse';
  select ip.id, ip.name into v_prod_p, v_nom_p from invoice_products ip
   where ip.kind = 'location'
     and ip.name = 'Abonnement hiver — ' || case when v_membre then 'membre' else 'non-membre' end || ' · heure pleine';

  for r in select * from tenant_rentals tr
            where tr.tenant_id = p_tenant and tr.season_label = p_season_label
            order by tr.weekday nulls last, tr.start_time nulls last
  loop
    v_total := v_total + tenant_rental_montant(r);
    v_jour := case r.weekday when 1 then 'Lundi' when 2 then 'Mardi' when 3 then 'Mercredi'
                             when 4 then 'Jeudi' when 5 then 'Vendredi' when 6 then 'Samedi'
                             when 7 then 'Dimanche' else '' end;
    v_nc := greatest(1, coalesce(array_length(string_to_array(coalesce(r.courts, ''), ','), 1), 1));

    if r.weekday is null or r.start_time is null or r.end_time is null then
      -- Créneau sans horaire : on ne peut pas le ventiler, on le dit tel quel.
      v_items := v_items || jsonb_build_object(
        'label', coalesce(nullif(btrim(r.label), ''), 'Location de courts'),
        'amount', tenant_rental_montant(r));
    else
      -- Heures pleines et creuses comptées séparément, courts compris.
      v_nb_c := 0; v_nb_p := 0;
      for v_h in select generate_series(extract(hour from r.start_time)::int,
                                        extract(hour from r.end_time)::int - 1)
      loop
        v_pleine := (v_pk -> r.weekday::text) @> to_jsonb(v_h);
        if v_pleine then v_nb_p := v_nb_p + v_nc; else v_nb_c := v_nb_c + v_nc; end if;
      end loop;

      if v_nb_c > 0 then
        v_prix := v_nb_c * (v_pr ->> ('hiver_' || case when v_membre then 'membre' else 'nonmembre' end || '_creuse'))::numeric;
        v_items := v_items || jsonb_build_object(
          'label', v_nom_c || ' — ' || v_jour || ' ' || to_char(r.start_time, 'HH24:MI')
                   || '–' || to_char(r.end_time, 'HH24:MI')
                   || coalesce(' · court ' || r.courts, '') || ' (' || v_nb_c || ' h)',
          'amount', v_prix);
        if v_prix > v_dom_montant then v_dom_montant := v_prix; v_dom := v_prod_c; end if;
      end if;
      if v_nb_p > 0 then
        v_prix := v_nb_p * (v_pr ->> ('hiver_' || case when v_membre then 'membre' else 'nonmembre' end || '_pleine'))::numeric;
        v_items := v_items || jsonb_build_object(
          'label', v_nom_p || ' — ' || v_jour || ' ' || to_char(r.start_time, 'HH24:MI')
                   || '–' || to_char(r.end_time, 'HH24:MI')
                   || coalesce(' · court ' || r.courts, '') || ' (' || v_nb_p || ' h)',
          'amount', v_prix);
        if v_prix > v_dom_montant then v_dom_montant := v_prix; v_dom := v_prod_p; end if;
      end if;
    end if;

    -- L'arrangement, sur sa propre ligne, avec son motif.
    if coalesce(r.ajustement_chf, 0) <> 0 then
      v_items := v_items || jsonb_build_object(
        'label', coalesce(nullif(btrim(r.ajustement_motif), ''), 'Arrangement convenu'),
        'amount', r.ajustement_chf, 'kind', 'rabais');
    end if;
  end loop;

  if v_total <= 0 then
    raise exception 'Aucun créneau facturable pour la saison %', p_season_label;
  end if;

  v_num := out_invoice_next_number();
  insert into out_invoices(number, filiere, tenant_id, person_id, product_id,
                           debtor_name, debtor_street, debtor_zip, debtor_city, debtor_email,
                           label, amount, issue_date, due_date, reference, status, items)
  values (v_num, 'location', p_tenant, t.person_id, v_dom,
          v_nom, v_rue, v_npa, v_ville, v_mail,
          'Abonnement hiver ' || p_season_label || ' — ' || t.name,
          v_total, current_date, coalesce(p_due, current_date + 30),
          out_invoice_scor(replace(v_num, '-', '')), 'a_envoyer', v_items)
  returning out_invoices.id into v_id;

  return query select v_id, v_num, v_total;
end $function$;
