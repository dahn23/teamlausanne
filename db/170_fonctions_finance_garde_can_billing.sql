-- ===================================================================
--  SÉCURITÉ (suite de db/169) : les fonctions financières se gardent aussi
-- ===================================================================
-- Après avoir refermé les vues, vérification du reste de la surface
-- financière avec un VRAI compte sans droits : celui d'un moniteur. Verdict :
--
--   out_invoices            → 0 ligne   ✔ la RLS fait son travail
--   out_invoice_reminders   → 0 ligne   ✔
--   out_a_facturer()        → 80 lignes �’ nom, filière et prix de 80 familles
--   out_resume_financier()  → 6 lignes  ✗ toute la situation financière du club
--
-- Les deux dernières sont SECURITY DEFINER : elles s'exécutent avec les droits
-- de leur propriétaire et traversent donc la RLS — c'est justement pour cela
-- qu'elles existent, les totaux devant être calculés sur TOUTES les factures,
-- y compris celles que l'appelant ne peut pas lire une par une.
--
-- Mais ce privilège réclame une porte, et elles n'en avaient pas. Un compte
-- moniteur, junior ou parent pouvait donc appeler la fonction et recevoir ce
-- que l'écran ne lui montre nulle part : 191 640 à envoyer, 82 861 à
-- encaisser, 23 041 encaissé, et le prix de chaque famille non encore
-- facturée. Il suffisait de la clé publiable et d'un navigateur.
--
-- can_billing(auth.uid()) est la même porte que la policy de out_invoices :
-- une seule règle pour la table et pour les fonctions qui la contournent.
-- Zéro ligne pour les autres, comme la RLS l'aurait fait.
--
-- À RETENIR : SECURITY DEFINER sans garde explicite = RLS désactivée pour tout
-- le monde. Le mot-clé ne protège rien, il ouvre. Le précédent existait déjà
-- dans le projet (person_pay_season filtre sur can_finance) — il fallait le
-- suivre.

create or replace function public.out_a_facturer()
returns table(person_id uuid, nom text, filiere text, product_id uuid, produit text, prix numeric)
language sql stable security definer set search_path = public as $$
  with saison as (
    select id from seasons where kind = 'juniors' and current_date between start_date and end_date
    order by start_date desc limit 1
  )
  select p.id, p.first_name || ' ' || p.last_name, rp.role::text, pr.id, pr.name, pr.price
    from role_periods rp
    join people p            on p.id = rp.person_id
    join invoice_products pr on pr.filiere = rp.role::text
                            and pr.active
                            and pr.kind = 'abonnement'
                            and pr.price is not null
   where can_billing(auth.uid())          -- ← la porte qui manquait
     and rp.season_id = (select id from saison)
     and not exists (
       select 1 from out_invoices f
        where f.person_id = rp.person_id
          and f.product_id = pr.id
          and f.status <> 'annulee'
     )
   order by 2;
$$;

-- Le résumé est une UNION de six agrégats : chaque branche renvoie une ligne
-- même sans données en entrée. Filtrer branche par branche ne suffirait donc
-- pas à rendre la fonction muette — on enveloppe le tout.
create or replace function public.out_resume_financier()
returns table(cle text, libelle text, montant numeric, n bigint, sous_total_de text, a_venir numeric)
language sql stable security definer set search_path = public as $$
  select * from (
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
       where not exists (
         select 1 from out_invoices f
          where f.tenant_id = r.tenant_id and f.status <> 'annulee')
    )
    select 'a_envoyer' as cle, 'À envoyer' as libelle, coalesce(sum(reste),0) as montant,
           count(*) as n, null::text as sous_total_de, null::numeric as a_venir
      from courant where status = 'a_envoyer'
    union all
    select 'a_encaisser','À encaisser', coalesce(sum(reste),0), count(*), null, null from courant where status = 'envoyee' and reste > 0.005
    union all
    select 'en_retard',  'En retard',   coalesce(sum(reste),0), count(*), 'a_encaisser', null from courant where status = 'envoyee' and reste > 0.005 and due_date < current_date
    union all
    select 'encaisse',   'Encaissé',    coalesce(sum(verse),0), count(*) filter (where verse > 0), null, null from courant
    union all
    select 'hiver',      'Abonnements hiver', coalesce(sum(reste),0), count(*), null, (select reste from hiver_du)
      from s where est_hiver and status <> 'annulee'
    union all
    select 'a_facturer', 'Reste à facturer',  coalesce(sum(prix),0), count(*), null, null from out_a_facturer()
  ) q
  where can_billing(auth.uid());          -- ← la porte qui manquait
$$;

revoke all on function public.out_a_facturer() from public, anon;
revoke all on function public.out_resume_financier() from public, anon;
grant execute on function public.out_a_facturer() to authenticated;
grant execute on function public.out_resume_financier() to authenticated;
