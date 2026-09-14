-- Facturation automatique à la saisie du contrat
--
-- Règle retenue : dès qu'un contrat porte un MONTANT ANNUEL, un NOMBRE
-- D'ÉCHÉANCES et que le joueur a une ADRESSE POSTALE complète, l'échéancier
-- part tout seul. Tant qu'il manque quelque chose, la fiche apparaît « en
-- attente » dans l'onglet Factures, avec la liste de ce qui manque.
--
-- Pourquoi cette condition et pas « contrat signé » : une QR-facture suisse a
-- besoin de l'adresse du débiteur, et un montant nul ne produit rien
-- d'envoyable. Sur les quatorze contrats de la saison, quatre n'avaient pas de
-- tarif et un pas d'adresse — un déclencheur naïf aurait émis des factures
-- fausses ou sans destinataire.
--
-- La condition est écrite UNE fois, dans out_invoice_manque(). Le déclencheur
-- et la liste des fiches en attente l'utilisent tous les deux : elles ne
-- peuvent donc pas diverger.

create or replace function public.out_invoice_filiere(p_programme text)
returns text language sql immutable as $$
  select case
    when p_programme ilike 'pro-u18%' or p_programme ilike 'pro u18%' then 'pro-u18'
    when p_programme ilike 'pro%'                                     then 'pro'
    else 'sport-etudes'   -- « sport-études » et « sport-études sans études »
  end;
$$;

-- NULL si le contrat est facturable, sinon ce qui manque, en toutes lettres.
create or replace function public.out_invoice_manque(p_person uuid, p_season uuid)
returns text language sql stable security definer set search_path = public as $$
  select nullif(concat_ws(' + ',
    case when nullif((select data->>'Annual fee'  from player_contracts
                       where person_id = p_person and season_id = p_season), '') is null
         then 'montant annuel' end,
    case when nullif((select data->>'Instalments' from player_contracts
                       where person_id = p_person and season_id = p_season), '') is null
         then 'nombre d''échéances' end,
    case when (select nullif(btrim(address),'')     is null
                   or nullif(btrim(postal_code),'') is null
                   or nullif(btrim(city),'')        is null
                 from people where id = p_person)
         then 'adresse postale' end
  ), '');
$$;

-- Numérotation sans contrôle de droits, réservée au déclencheur.
create or replace function public.out_invoice_next_number_sys()
returns text language plpgsql security definer set search_path = public as $$
declare v_year text := to_char(current_date, 'YYYY'); v_seq int;
begin
  perform pg_advisory_xact_lock(hashtext('out_invoice_number'));
  select coalesce(max(substring(number from 6)::int), 0) + 1 into v_seq
    from out_invoices where number like v_year || '-%' and substring(number from 6) ~ '^\d+$';
  return v_year || '-' || lpad(v_seq::text, 4, '0');
end;$$;

-- Le cœur de la génération, SANS contrôle de droits : appelé soit par la
-- fonction publique (qui contrôle), soit par le déclencheur (qui agit au nom du
-- système — sinon un coach enregistrant un contrat ne déclencherait rien).
-- Corps identique à 64_out_invoices_echeancier.sql, la vérification en moins.
-- Non exécutable directement (voir les REVOKE en fin de fichier).
create or replace function public.out_invoices_echeancier_interne(
  p_person uuid, p_season uuid, p_filiere text, p_essai boolean default true
) returns table (echeance int, montant numeric, emise date, echue date, destinataire text, numero text)
language plpgsql security definer set search_path = public as $$
declare
  v_p record; v_d jsonb; v_fee numeric; v_n int; v_unit numeric; v_dernier numeric;
  v_saison text; v_nom text; v_dest_nom text; v_dest_mail text; v_dest_pid uuid;
  v_parent text; v_compte uuid; v_num text; v_due date; v_iss date; v_lib text; k int;
begin
  select pe.*, s.label as saison_label into v_p
    from people pe cross join lateral (select label from seasons where id = p_season) s
   where pe.id = p_person;
  if v_p is null then raise exception 'Joueur introuvable'; end if;

  select data into v_d from player_contracts where person_id = p_person and season_id = p_season;
  v_fee := nullif(v_d->>'Annual fee','')::numeric;
  v_n   := nullif(v_d->>'Instalments','')::int;
  if v_fee is null or v_fee <= 0 or v_n is null or v_n < 1 then
    raise exception 'Contrat incomplet (montant annuel ou nombre d''échéances manquant)';
  end if;

  if exists (select 1 from out_invoices where person_id = p_person and season_id = p_season) then
    raise exception 'Ce joueur a déjà des factures pour cette saison';
  end if;

  v_saison := v_p.saison_label;
  v_nom    := v_p.first_name || ' ' || v_p.last_name;

  select g.guardian_id into v_dest_pid
    from guardianships g where g.child_id = p_person and g.relation <> 'sibling' limit 1;
  if v_dest_pid is not null then
    select first_name || ' ' || last_name, email into v_dest_nom, v_dest_mail
      from people where id = v_dest_pid;
  else
    v_parent := v_p.parent1;
    if v_parent is not null and v_parent <> '' then
      v_dest_nom  := btrim(split_part(v_parent, '·', 1));
      v_dest_mail := (select btrim(x) from unnest(string_to_array(v_parent, '·')) x where x like '%@%' limit 1);
    end if;
    if coalesce(v_dest_nom,'') = '' then v_dest_nom := v_nom; v_dest_mail := v_p.email; end if;
  end if;

  select id into v_compte from finance_accounts order by is_default desc, sort limit 1;

  v_unit    := round(v_fee / v_n, 2);
  v_dernier := round(v_fee - v_unit * (v_n - 1), 2);

  for k in 1..v_n loop
    v_due := (date '2026-08-30' + ((k - 1) || ' months')::interval)::date;
    v_iss := greatest(current_date, v_due - 30);
    v_lib := p_filiere || ' ' || v_saison || ' — échéance ' || k || '/' || v_n || ' — ' || v_nom;

    if p_essai then
      v_num := '(essai)';
    else
      v_num := out_invoice_next_number_sys();
      insert into out_invoices (
        number, season_id, filiere, person_id, debtor_person_id,
        debtor_name, debtor_street, debtor_zip, debtor_city, debtor_email,
        label, items, instalment_no, instalment_total,
        amount, currency, issue_date, due_date, reference, account_id, status, created_by)
      values (
        v_num, p_season, p_filiere, p_person, v_dest_pid,
        v_dest_nom, nullif(btrim(v_p.address),''), nullif(btrim(v_p.postal_code),''),
        nullif(btrim(v_p.city),''), v_dest_mail,
        v_lib, jsonb_build_array(jsonb_build_object('label', v_lib,
               'amount', case when k = v_n then v_dernier else v_unit end)),
        k, v_n,
        case when k = v_n then v_dernier else v_unit end, 'CHF',
        v_iss, v_due, out_invoice_scor(regexp_replace(v_num, '\D', '', 'g')),
        v_compte, 'a_envoyer', auth.uid());
    end if;

    echeance := k; montant := case when k = v_n then v_dernier else v_unit end;
    emise := v_iss; echue := v_due; destinataire := v_dest_nom; numero := v_num;
    return next;
  end loop;
end;
$$;

-- La fonction publique délègue, après son contrôle de droits.
create or replace function public.out_invoices_echeancier(
  p_person uuid, p_season uuid, p_filiere text, p_essai boolean default true
) returns table (echeance int, montant numeric, emise date, echue date, destinataire text, numero text)
language plpgsql security definer set search_path = public as $$
begin
  if not can_finance(auth.uid()) then raise exception 'Accès refusé'; end if;
  return query select * from out_invoices_echeancier_interne(p_person, p_season, p_filiere, p_essai);
end;
$$;

-- Le déclencheur. Il ne doit JAMAIS faire échouer l'enregistrement du contrat :
-- une facturation qui casse ne doit pas empêcher de saisir un contrat. D'où le
-- bloc d'exception, qui avale tout et laisse la fiche « en attente ».
create or replace function public.player_contract_facturer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if out_invoice_manque(new.person_id, new.season_id) is null
     and not exists (select 1 from out_invoices
                      where person_id = new.person_id and season_id = new.season_id) then
    begin
      perform out_invoices_echeancier_interne(
        new.person_id, new.season_id,
        out_invoice_filiere(new.data->>'Programme'), false);
    exception when others then
      raise warning 'Facturation auto impossible (%) : %', new.person_id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists player_contract_facturer on public.player_contracts;
create trigger player_contract_facturer
after insert or update of data on public.player_contracts
for each row execute function public.player_contract_facturer();

-- Les fiches en attente, affichées en tête de l'onglet Factures.
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
     and out_invoice_manque(pc.person_id, pc.season_id) is not null
     and not exists (select 1 from out_invoices oi
                      where oi.person_id = pc.person_id and oi.season_id = pc.season_id)
   order by pe.last_name, pe.first_name;
$$;

revoke all on function public.out_invoices_echeancier_interne(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.out_invoice_next_number_sys()                              from public, anon, authenticated;
revoke all on function public.out_invoice_filiere(text)      from public, anon;
revoke all on function public.out_invoice_manque(uuid, uuid) from public, anon;
revoke all on function public.out_invoices_en_attente()      from public, anon;
grant execute on function public.out_invoice_filiere(text)      to authenticated;
grant execute on function public.out_invoice_manque(uuid, uuid) to authenticated;
grant execute on function public.out_invoices_en_attente()      to authenticated;
