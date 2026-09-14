-- Libellé lisible de la filière sur les factures
--
-- Le générateur écrivait le code brut « sport-etudes » dans le libellé, qui
-- apparaît dans l'objet du courriel ET sur le PDF envoyé aux familles. La
-- console, elle, affiche « Sport-études ». Les factures préparées par la
-- fonction n'avaient donc pas la même allure que celles faites à la main.
--
-- Cette fonction reprend la table de correspondance de la console (OI_FIL_ALL).
create or replace function public.out_invoice_filiere_label(p_filiere text)
returns text language sql immutable as $$
  select case p_filiere
    when 'sport-etudes' then 'Sport-études'
    when 'pro'          then 'Pro'
    when 'pro-u18'      then 'Pro U18'
    when 'competition'  then 'Compétition'
    when 'performance'  then 'Performance'
    when 'club'         then 'Club'
    when 'kidstennis'   then 'Kids Tennis'
    else p_filiere end;
$$;

revoke all on function public.out_invoice_filiere_label(text) from public, anon;
grant execute on function public.out_invoice_filiere_label(text) to authenticated;

-- out_invoices_echeancier_interne() a été redéfinie pour l'utiliser ; voir
-- 65_out_invoices_auto_contrat.sql, seule la ligne du libellé change :
--   v_lib := out_invoice_filiere_label(p_filiere) || ' ' || v_saison || …
--
-- Rattrapage appliqué aux 96 factures déjà préparées (aucune n'était envoyée) :
--   update out_invoices
--      set label = out_invoice_filiere_label(filiere) || substring(label from position(' ' in label)),
--          items = jsonb_build_array(jsonb_build_object('label', …, 'amount', amount))
--    where status = 'a_envoyer'
--      and label <> out_invoice_filiere_label(filiere) || substring(label from position(' ' in label));
