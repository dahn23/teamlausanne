-- Le rappel des fiches en attente se limite aux joueurs réellement au programme
--
-- Une fiche de contrat peut subsister pour quelqu'un qui a quitté la filière :
-- elle restait affichée indéfiniment dans le bandeau de l'onglet Factures, et
-- le seul moyen de l'en sortir aurait été de supprimer des données.
--
-- Le critère retenu est le rôle de filière de la saison (role_periods), source
-- de vérité de « qui est au programme cette année ». Retirer ce rôle suffit
-- désormais à sortir quelqu'un du rappel, sans rien effacer — et l'inverse est
-- vrai aussi : réinscrire quelqu'un le fait réapparaître.
create or replace function public.out_invoices_en_attente()
returns table (person_id uuid, joueur text, programme text, manque text)
language sql stable security definer set search_path = public as $$
  select pe.id,
         pe.first_name || ' ' || pe.last_name,
         pc.data->>'Programme',
         out_invoice_manque(pc.person_id, pc.season_id)
    from player_contracts pc
    join people pe on pe.id = pc.person_id
    join seasons s on s.id = pc.season_id
   where can_finance(auth.uid())
     and current_date between s.start_date and s.end_date
     and exists (select 1 from role_periods rp
                  where rp.person_id = pc.person_id and rp.season_id = pc.season_id)
     and out_invoice_manque(pc.person_id, pc.season_id) is not null
     and not exists (select 1 from out_invoices oi
                      where oi.person_id = pc.person_id and oi.season_id = pc.season_id)
   order by pe.last_name, pe.first_name;
$$;

revoke all on function public.out_invoices_en_attente() from public, anon;
grant execute on function public.out_invoices_en_attente() to authenticated;

-- Rappel (appliqué manuellement, non rejouable) : les factures d'un joueur dont
-- l'adresse change se corrigent SUR PLACE, sans renuméroter — une numérotation
-- de factures doit rester continue. Effacer pdf_path suffit à faire régénérer
-- le PDF à l'ouverture de l'onglet ; il s'écrase au même emplacement.
--   update out_invoices oi set debtor_street = p.address, debtor_zip = p.postal_code,
--          debtor_city = p.city, pdf_path = null
--     from people p where oi.person_id = p.id and oi.status = 'a_envoyer';
