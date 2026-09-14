-- Factures émises : échéancier complet en une fois
--
-- La console ne créait qu'UNE échéance par passage : dix à douze manipulations
-- par joueur, soit près de quatre-vingts pour une rentrée. D'où cette fonction,
-- qui produit l'échéancier entier d'un joueur pour une saison.
--
-- Elle servira aussi au déclenchement automatique à la signature d'un contrat :
-- c'est la même logique, il ne manquera qu'un déclencheur.
--
-- Trois précautions qui comptent :
--   · le DERNIER montant absorbe l'arrondi, pour que la somme facturée tombe
--     exactement sur le montant du contrat. Sans cela, Ylan Allenspach aurait
--     été facturé 14 289.96 pour un contrat à 14 290.– ;
--   · rien n'est généré si le joueur a déjà des factures sur la saison, ce qui
--     rend la fonction rejouable sans risque de doublon ;
--   · p_essai = true simule sans rien écrire — toujours simuler d'abord.

-- Référence SCOR (ISO 11649) : « RF » + 2 chiffres de contrôle (mod 97-10) +
-- les chiffres du numéro. Même algorithme que la console — vérifié : retrouve
-- à l'identique les dix références déjà émises pour Célyan Lorival.
create or replace function public.out_invoice_scor(p_base text)
returns text
language plpgsql
immutable
as $$
declare s text := upper(p_base) || 'RF00'; t text := ''; ch text; m int := 0;
begin
  for i in 1..length(s) loop
    ch := substr(s, i, 1);
    if ch ~ '[A-Z]' then t := t || (ascii(ch) - 55)::text; else t := t || ch; end if;
  end loop;
  for i in 1..length(t) loop
    m := (m * 10 + substr(t, i, 1)::int) % 97;
  end loop;
  return 'RF' || lpad((98 - m)::text, 2, '0') || p_base;
end;
$$;

create or replace function public.out_invoices_echeancier(
  p_person  uuid,
  p_season  uuid,
  p_filiere text,
  p_essai   boolean default true
) returns table (echeance int, montant numeric, emise date, echue date, destinataire text, numero text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p         record;
  v_d         jsonb;
  v_fee       numeric;
  v_n         int;
  v_unit      numeric;
  v_dernier   numeric;
  v_saison    text;
  v_nom       text;
  v_dest_nom  text;
  v_dest_mail text;
  v_dest_pid  uuid;
  v_parent    text;
  v_compte    uuid;
  v_num       text;
  v_due       date;
  v_iss       date;
  v_lib       text;
  k           int;
begin
  if not can_finance(auth.uid()) then raise exception 'Accès refusé'; end if;

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

  -- Destinataire : parent lié en priorité, sinon le texte « Parent 1 » de la
  -- fiche (« Nom · téléphone · e-mail »), sinon le joueur lui-même.
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

  -- Le dernier montant absorbe l'arrondi : la somme doit égaler le contrat.
  v_unit    := round(v_fee / v_n, 2);
  v_dernier := round(v_fee - v_unit * (v_n - 1), 2);

  for k in 1..v_n loop
    -- Échéances mensuelles le 30, à partir du 30 août ; émission 30 jours avant,
    -- jamais dans le passé (les premières, en retard, sortent aujourd'hui).
    v_due := (date '2026-08-30' + ((k - 1) || ' months')::interval)::date;
    v_iss := greatest(current_date, v_due - 30);
    v_lib := p_filiere || ' ' || v_saison || ' — échéance ' || k || '/' || v_n || ' — ' || v_nom;

    if p_essai then
      v_num := '(essai)';
    else
      v_num := out_invoice_next_number();
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

    echeance := k;
    montant  := case when k = v_n then v_dernier else v_unit end;
    emise    := v_iss;
    echue    := v_due;
    destinataire := v_dest_nom;
    numero   := v_num;
    return next;
  end loop;
end;
$$;

revoke all on function public.out_invoices_echeancier(uuid, uuid, text, boolean) from public, anon;
revoke all on function public.out_invoice_scor(text) from public, anon;
grant execute on function public.out_invoices_echeancier(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.out_invoice_scor(text) to authenticated;
