-- Échéancier : première échéance double.
--
-- Pratique de la maison : à l'entrée d'un joueur on facture DEUX mois d'un coup,
-- pour la trésorerie, puis on passe au mensuel. L'échéancier ne savait faire que
-- du mensuel régulier, si bien qu'il fallait refaire le découpage à la main
-- chaque fois.
--
-- Une facture double plutôt que deux bulletins envoyés ensemble : une facture =
-- une référence QR = un paiement. Deux bulletins réglés d'un seul virement
-- laissent l'un des deux ouvert pour toujours, et on relance une famille qui a
-- payé. Le rapprochement bancaire ne pardonne pas ça.
--
-- Le total ne bouge pas : un contrat à N mensualités devient N-1 factures, la
-- première valant deux mois. L'échéance de cette première est celle du DEUXIÈME
-- mois — elle couvre les deux, autant retenir la plus tardive : une facture née
-- déjà en retard se lit mal.
--
-- p_double est facultatif et vaut « vrai » : c'est la pratique courante. Le
-- déclencheur qui facture à la saisie du contrat en hérite donc sans changement.

create or replace function public.out_invoices_echeancier_interne(
  p_person uuid, p_season uuid, p_filiere text,
  p_essai boolean default true, p_double boolean default true
) returns table (echeance int, montant numeric, emise date, echue date, destinataire text, numero text)
language plpgsql security definer set search_path = public as $$
declare
  v_p record; v_d jsonb; v_fee numeric; v_n int; v_unit numeric;
  v_saison text; v_nom text; v_dest_nom text; v_dest_mail text; v_dest_pid uuid;
  v_parent text; v_compte uuid; v_num text; v_due date; v_iss date; v_lib text;
  v_lignes int; v_mois int; v_mt numeric; v_cumul numeric := 0; v_txt text; k int;
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
  -- Un contrat d'une seule mensualité n'a rien à doubler.
  if v_n < 2 then p_double := false; end if;

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

  v_unit   := round(v_fee / v_n, 2);
  v_lignes := case when p_double then v_n - 1 else v_n end;

  for k in 1..v_lignes loop
    -- Combien de mois cette ligne couvre, et quel mois elle vise.
    if p_double and k = 1 then
      v_mois := 2; v_due := (date '2026-08-30' + interval '1 month')::date;
      v_txt  := 'échéances 1-2/' || v_n || ' (double)';
    else
      v_mois := 1;
      v_due  := (date '2026-08-30' + ((case when p_double then k else k - 1 end) || ' months')::interval)::date;
      v_txt  := 'échéance ' || (case when p_double then k + 1 else k end) || '/' || v_n;
    end if;

    -- La dernière ligne absorbe l'arrondi : le total facturé doit tomber au
    -- centime sur le montant du contrat.
    if k = v_lignes then v_mt := round(v_fee - v_cumul, 2);
    else                 v_mt := round(v_unit * v_mois, 2); end if;
    v_cumul := v_cumul + v_mt;

    v_iss := greatest(current_date, v_due - 30);
    v_lib := out_invoice_filiere_label(p_filiere) || ' ' || v_saison || ' — ' || v_txt || ' — ' || v_nom;

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
        v_lib, jsonb_build_array(jsonb_build_object('label', v_lib, 'amount', v_mt)),
        k, v_lignes, v_mt, 'CHF',
        v_iss, v_due, out_invoice_scor(regexp_replace(v_num, '\D', '', 'g')),
        v_compte, 'a_envoyer', auth.uid());
    end if;

    echeance := k; montant := v_mt; emise := v_iss; echue := v_due;
    destinataire := v_dest_nom; numero := v_num;
    return next;
  end loop;
end;
$$;

revoke all on function public.out_invoices_echeancier_interne(uuid, uuid, text, boolean, boolean) from public, anon, authenticated;
