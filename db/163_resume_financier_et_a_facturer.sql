-- ===========================================================================
--  163 — Vue d'ensemble financière (point 8) et « reste à facturer » (point 5)
-- ---------------------------------------------------------------------------
--  Le piège que l'équipe a nommé, et qu'on évite ici : le double comptage.
--    · « En retard » est une PARTIE de « à encaisser », pas un montant de plus.
--    · « Abonnements hiver » est une catégorie à part : elle est donc EXCLUE
--      des quatre premières, et non ajoutée par-dessus.
--  Chaque ligne dit de quel total elle est un sous-ensemble (sous_total_de),
--  pour qu'on ne puisse pas additionner ce qui ne s'additionne pas.
--
--  Tout part d'out_invoices_solde (db/161) : les montants tiennent compte des
--  versements partiels et des annulations partielles, sans quoi les totaux
--  mentiraient dès le premier acompte.
--
--  « Reste à facturer » ne vaut que pour les abonnements à prix de saison.
--  Au premier essai la liste sortait 125 personnes, dont 42 en Privé-adultes :
--  ces cours se facturent à la leçon, pas à la saison. Même chose pour
--  Sport-études, Pro et Pro U18, dont les factures naissent du contrat de la
--  fiche (et dont les dossiers incomplets sont déjà suivis par
--  out_invoices_en_attente). Un produit sans prix de saison n'est pas un
--  abonnement, et il n'y a rien à y estimer : 80 personnes, 63 985 CHF.
-- ===========================================================================
create or replace function out_a_facturer()
returns table(person_id uuid, nom text, filiere text, product_id uuid, produit text, prix numeric)
language sql stable security definer set search_path to 'public' as $$
  with saison as (
    select id from seasons where kind = 'juniors' and current_date between start_date and end_date
    order by start_date desc limit 1
  )
  select p.id, p.first_name || ' ' || p.last_name, rp.role::text, pr.id, pr.name, pr.price
    from role_periods rp
    join people p            on p.id = rp.person_id
    join invoice_products pr on pr.filiere = rp.role::text
                            and pr.active and pr.kind = 'abonnement' and pr.price is not null
   where rp.season_id = (select id from saison)
     and not exists (
       select 1 from out_invoices f
        where f.person_id = rp.person_id and f.product_id = pr.id and f.status <> 'annulee')
   order by 2;
$$;

create or replace function out_resume_financier()
returns table(cle text, libelle text, montant numeric, n bigint, sous_total_de text)
language sql stable security definer set search_path to 'public' as $$
  with s as (
    select f.*, (pr.kind = 'location') as est_hiver
      from out_invoices_solde f
      left join invoice_products pr on pr.id = f.product_id
  ),
  courant as (select * from s where not coalesce(est_hiver, false))
  select 'a_envoyer', 'À envoyer',   coalesce(sum(reste),0), count(*), null from courant where status = 'a_envoyer'
  union all
  select 'a_encaisser','À encaisser', coalesce(sum(reste),0), count(*), null from courant where status = 'envoyee' and reste > 0.005
  union all
  select 'en_retard',  'En retard',   coalesce(sum(reste),0), count(*), 'a_encaisser' from courant where status = 'envoyee' and reste > 0.005 and due_date < current_date
  union all
  select 'encaisse',   'Encaissé',    coalesce(sum(verse),0), count(*) filter (where verse > 0), null from courant
  union all
  select 'hiver',      'Abonnements hiver', coalesce(sum(reste),0), count(*), null, (select reste from hiver_du) from s where est_hiver and status <> 'annulee'
  union all
  select 'a_facturer', 'Reste à facturer',  coalesce(sum(prix),0), count(*), null from out_a_facturer();
$$;

-- ---------------------------------------------------------------------------
--  Correction (16.10.2026) — l'argent invisible
-- ---------------------------------------------------------------------------
--  Vu à l'écran : la tuile « Abonnements hiver » affichait 0.00 alors que
--  27 200 CHF de créneaux attendaient d'être facturés. Ces 27 200 n'étaient
--  nulle part : ni ici (qui ne compte que des factures, et il n'y en avait
--  aucune), ni dans « reste à facturer » (qui ne couvre que les abonnements
--  de filière). De l'argent qu'on ne voyait pas.
--
--  D'où la colonne « a_venir » : ce qui reste à facturer dans la catégorie, à
--  côté de ce qui l'est déjà. Les abonnements d'hiver restent SÉPARÉS des
--  autres totaux, comme demandé — on les rend seulement visibles.
drop function if exists out_resume_financier();
create or replace function out_resume_financier()
returns table(cle text, libelle text, montant numeric, n bigint, sous_total_de text, a_venir numeric)
language sql stable security definer set search_path to 'public' as $$
  with s as (
    select f.*, (pr.kind = 'location') as est_hiver
      from out_invoices_solde f
      left join invoice_products pr on pr.id = f.product_id
  ),
  courant as (select * from s where not coalesce(est_hiver, false)),
  hiver_du as (
    select coalesce(sum(r.amount_chf), 0) as reste
      from tenant_rentals r
      join court_tenants t on t.id = r.tenant_id and t.active
     where not exists (select 1 from out_invoices f where f.tenant_id = r.tenant_id and f.status <> 'annulee')
  )
  select 'a_envoyer', 'À envoyer',   coalesce(sum(reste),0), count(*), null, null::numeric from courant where status = 'a_envoyer'
  union all
  select 'a_encaisser','À encaisser', coalesce(sum(reste),0), count(*), null, null from courant where status = 'envoyee' and reste > 0.005
  union all
  select 'en_retard',  'En retard',   coalesce(sum(reste),0), count(*), 'a_encaisser', null from courant where status = 'envoyee' and reste > 0.005 and due_date < current_date
  union all
  select 'encaisse',   'Encaissé',    coalesce(sum(verse),0), count(*) filter (where verse > 0), null, null from courant
  union all
  select 'hiver',      'Abonnements hiver', coalesce(sum(reste),0), count(*), null, (select reste from hiver_du) from s where est_hiver and status <> 'annulee'
  union all
  select 'a_facturer', 'Reste à facturer',  coalesce(sum(prix),0), count(*), null, null from out_a_facturer();
$$;
