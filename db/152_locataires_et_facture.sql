-- Locations de courts : généralisation des « clubs » + bouton « Créer la facture » (14.10.2026).
--
-- db/151 n'avait prévu que des clubs. Or trois natures de locataires paient
-- pour les mêmes courts : un CLUB (TC Pully), un MEMBRE du club, et un COACH
-- EXTERNE de la région. Rien ne les distingue au moment de facturer — même
-- créneaux, même tarif, même facture. Ce qui change, c'est seulement QUI paie.
--
-- D'où le choix : UNE liste de locataires, avec une nature, plutôt que trois
-- tables parallèles qu'il faudrait réunir à chaque question (« qui loue nos
-- courts, et combien nous doivent-ils ? »). La nature est une propriété du
-- locataire, pas une sorte différente d'objet.
--
-- `person_id` relie un membre ou un coach externe à sa fiche quand elle existe :
-- on ne retape pas une adresse déjà connue, et on ne crée pas un deuxième
-- dossier pour quelqu'un que le répertoire tient déjà. Un club, lui, n'a pas de
-- fiche et n'en a pas besoin — d'où une colonne facultative, pas une jointure
-- obligatoire.
--
-- La table est renommée parce qu'elle ne parle plus de clubs. Elle est vide et
-- date d'hier : le renommage ne coûte rien aujourd'hui, et laisser un nom qui
-- ment coûterait à chaque lecture.

alter table public.clubs rename to court_tenants;
alter table public.club_rentals rename to tenant_rentals;
alter table public.tenant_rentals rename column club_id to tenant_id;

alter table public.court_tenants add column if not exists kind text not null default 'club';
alter table public.court_tenants drop constraint if exists court_tenants_kind_connu;
alter table public.court_tenants add constraint court_tenants_kind_connu
  check (kind in ('club', 'membre', 'externe'));

alter table public.court_tenants add column if not exists person_id uuid
  references public.people(id) on delete set null;
create index if not exists court_tenants_person_idx on public.court_tenants(person_id);

-- Un club n'est pas une personne : lier une fiche à un locataire de nature
-- « club » est forcément une erreur de saisie.
alter table public.court_tenants drop constraint if exists court_tenants_club_sans_fiche;
alter table public.court_tenants add constraint court_tenants_club_sans_fiche
  check (kind <> 'club' or person_id is null);

alter index if exists clubs_nom_idx rename to court_tenants_nom_idx;
alter index if exists club_rentals_club_idx rename to tenant_rentals_tenant_idx;

drop function if exists public.club_rental_montant(public.club_rentals);
create or replace function public.tenant_rental_montant(r public.tenant_rentals)
returns numeric language sql immutable as $$
  select coalesce(r.amount_chf, round(coalesce(r.hours, 0) * coalesce(r.rate_chf, 0), 2));
$$;

-- Les policies suivent le renommage (leur nom seul était resté).
drop policy if exists clubs_staff on public.court_tenants;
drop policy if exists court_tenants_staff on public.court_tenants;
create policy court_tenants_staff on public.court_tenants for all
  using (is_staff(auth.uid())) with check (is_staff(auth.uid()));

drop policy if exists club_rentals_staff on public.tenant_rentals;
drop policy if exists tenant_rentals_staff on public.tenant_rentals;
create policy tenant_rentals_staff on public.tenant_rentals for all
  using (is_staff(auth.uid())) with check (is_staff(auth.uid()));

grant select, insert, update, delete on public.court_tenants  to authenticated;
grant select, insert, update, delete on public.tenant_rentals to authenticated;

-- ---------------------------------------------------------------------------
-- La facture.
--
-- Nouvelle filière « location » : les locations ne sont pas le programme Club
-- (815.– par enfant). Les mélanger fausserait les totaux par filière, qui
-- servent à suivre les recettes d'enseignement.
create or replace function public.out_invoice_filiere_label(p_filiere text)
returns text language sql immutable as $function$
  select case p_filiere
    when 'sport-etudes' then 'Sport-études'
    when 'pro'          then 'Pro'
    when 'pro-u18'      then 'Pro U18'
    when 'competition'  then 'Compétition'
    when 'performance'  then 'Performance'
    when 'club'         then 'Club'
    when 'kidstennis'   then 'Kids Tennis'
    when 'location'     then 'Location de courts'
    else p_filiere end;
$function$;

alter table public.out_invoices add column if not exists tenant_id uuid
  references public.court_tenants(id) on delete set null;
create index if not exists out_invoices_tenant_idx on public.out_invoices(tenant_id);

-- Création de la facture EN BASE, pas dans le navigateur : numéro, référence
-- RF et lignes doivent naître ensemble ou pas du tout. Le numéro est tiré sous
-- verrou (out_invoice_next_number) ; le faire en deux appels depuis le client
-- ouvrirait la porte à deux factures du même numéro.
-- Deux pièges de plpgsql, tombés tous les deux à l'essai avant la mise en
-- service — raison pour laquelle cette fonction a été exercée en vrai, avec
-- une identité de facturation, et pas seulement relue :
--   · les colonnes de RETURNS TABLE sont des variables dans le corps : nommer
--     la première `id` rendait `where id = p_tenant` ambigu. D'où `inv_id`,
--     `inv_number`, `inv_amount` ;
--   · une variable `record` ne se convertit pas en type composite : la boucle
--     doit être déclarée `%rowtype` pour pouvoir passer la ligne à
--     tenant_rental_montant().
create or replace function public.tenant_invoice_create(
  p_tenant uuid, p_season_label text, p_due date default null)
returns table(inv_id uuid, inv_number text, inv_amount numeric)
language plpgsql security definer set search_path to 'public' as $function$
declare
  t public.court_tenants%rowtype;
  r public.tenant_rentals%rowtype;
  v_num text; v_id uuid; v_total numeric := 0; v_m numeric;
  v_items jsonb := '[]'::jsonb; v_nom text; v_rue text; v_npa text; v_ville text; v_mail text;
begin
  if not can_billing(auth.uid()) then raise exception 'Accès refusé'; end if;

  select * into t from court_tenants ct where ct.id = p_tenant;
  if not found then raise exception 'Locataire introuvable'; end if;

  -- Le destinataire : la fiche du répertoire quand il y en a une (elle est
  -- tenue à jour par le secrétariat), sinon ce que porte le locataire. Ce qui
  -- est saisi sur le locataire l'emporte : c'est l'adresse de FACTURATION,
  -- qui n'est pas forcément le domicile.
  v_nom := t.name; v_rue := t.address; v_npa := t.postal_code;
  v_ville := t.city; v_mail := t.contact_email;
  if t.person_id is not null then
    select coalesce(nullif(btrim(pe.first_name || ' ' || pe.last_name), ''), t.name),
           coalesce(t.address, pe.address), coalesce(t.postal_code, pe.postal_code),
           coalesce(t.city, pe.city), coalesce(t.contact_email, pe.email)
      into v_nom, v_rue, v_npa, v_ville, v_mail
      from people pe where pe.id = t.person_id;
  end if;

  for r in select * from tenant_rentals tr
            where tr.tenant_id = p_tenant and tr.season_label = p_season_label
            order by tr.weekday nulls last, tr.start_time nulls last
  loop
    v_m := tenant_rental_montant(r);
    v_total := v_total + v_m;
    v_items := v_items || jsonb_build_object(
      'label', coalesce(nullif(btrim(r.label), ''),
        nullif(btrim(coalesce(case r.weekday
          when 1 then 'Lundi' when 2 then 'Mardi' when 3 then 'Mercredi' when 4 then 'Jeudi'
          when 5 then 'Vendredi' when 6 then 'Samedi' when 7 then 'Dimanche' else '' end, '')
          || coalesce(' ' || to_char(r.start_time, 'HH24:MI'), '')
          || coalesce('–' || to_char(r.end_time, 'HH24:MI'), '')
          || coalesce(' · courts ' || r.courts, '')), ''),
        'Location de courts'),
      'amount', v_m);
  end loop;

  if v_total <= 0 then
    raise exception 'Aucun créneau facturable pour la saison %', p_season_label;
  end if;

  v_num := out_invoice_next_number();
  insert into out_invoices(number, filiere, tenant_id, person_id,
                           debtor_name, debtor_street, debtor_zip, debtor_city, debtor_email,
                           label, amount, issue_date, due_date, reference, status, items)
  values (v_num, 'location', p_tenant, t.person_id,
          v_nom, v_rue, v_npa, v_ville, v_mail,
          'Location de courts ' || p_season_label || ' — ' || t.name,
          v_total, current_date, coalesce(p_due, current_date + 30),
          out_invoice_scor(replace(v_num, '-', '')), 'a_envoyer', v_items)
  returning out_invoices.id into v_id;

  return query select v_id, v_num, v_total;
end $function$;

revoke all on function public.tenant_invoice_create(uuid, text, date) from public, anon;
grant execute on function public.tenant_invoice_create(uuid, text, date) to authenticated;

-- Essayé en vrai le 14.10.2026, avec l'identité d'un superadmin :
--   60 h × 45.– + forfait 1 200.– = 3 900.– ; facture 2026-0323, filière
--   « location », référence RF6720260323 validée par un contrôle ISO 11649
--   indépendant (mod 97 = 1) ; deux lignes d'article, destinataire repris du
--   locataire ; lien tenant_id posé. Les quatre refus attendus refusent :
--   appel anonyme, saison sans créneau, locataire inexistant, et un club à qui
--   l'on tente d'attacher une fiche de personne. Données d'essai supprimées,
--   numérotation revenue à 2026-0322.
