-- ===================================================================
--  FACTURES › le produit posé à la création, pas une fois pour toutes
-- ===================================================================
-- db/161 a rattaché son produit à chaque facture existante : 315 sur 317, et
-- les deux restantes sont des factures blanches, sans produit par nature. Très
-- bien — mais c'était une MISE À JOUR, exécutée une fois. Rien ne la rejoue.
--
-- Or le lot par filière (oiGenerate), l'échéancier de contrat et les factures
-- de stage insèrent sans product_id. Autrement dit : le jour où le secrétariat
-- génère le prochain lot Club, ces quarante factures naissent sans produit, et
-- elles disparaissent du filtre par produit (point 2), du contrôle de
-- cohérence produit/cours (point 2), de « à facturer » (point 5) et des
-- pastilles de l'onglet Relances. Sans message d'erreur : juste un filtre qui
-- ne les voit pas. On ne s'en apercevrait qu'en cherchant une facture qu'on
-- sait avoir émise.
--
-- Les trois règles de rattrapage de db/161 deviennent donc un TRIGGER. Même
-- logique, même ordre, mais appliquée à la naissance de chaque facture : aucun
-- chemin de création ne peut plus l'oublier, y compris ceux qu'on écrira
-- l'année prochaine.
--
-- Ce qui ne correspond à rien reste à NULL, et c'est voulu : une facture
-- blanche n'a pas de produit, et deviner lui en donnerait un faux.

create or replace function public.out_invoices_produit_defaut()
returns trigger language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if new.product_id is not null then return new; end if;

  -- 1) Le libellé nomme le produit (« Kids Tennis 2026/27 — … »). On part du
  --    nom le plus long, sans quoi « Privé » avalerait « Privé-adultes ».
  select p.id into v
    from invoice_products p
   where p.kind <> 'stage'
     and new.label ilike '%' || p.name || '%'
     and not exists (
       select 1 from invoice_products q
        where q.id <> p.id
          and length(q.name) > length(p.name)
          and new.label ilike '%' || q.name || '%')
   order by length(p.name) desc
   limit 1;

  -- 2) Les stages : la catégorie est dans le libellé (« … — Loisir matin »).
  if v is null and new.filiere = 'stage' then
    select p.id into v
      from invoice_products p
     where p.kind = 'stage'
       and new.label ilike '%' || replace(p.name, 'Stage ', '') || '%'
     order by length(p.name) desc
     limit 1;
  end if;

  -- 3) Les mensualités Sport-études et Pro : leur libellé dit « mensualité
  --    9/12 » et non le produit, mais elles portent leur filière.
  if v is null and new.filiere is not null then
    select p.id into v
      from invoice_products p
     where p.filiere = new.filiere and p.kind = 'abonnement'
     limit 1;
  end if;

  new.product_id := v;
  return new;
end $$;

drop trigger if exists out_invoices_produit on public.out_invoices;
create trigger out_invoices_produit
  before insert on public.out_invoices
  for each row execute function public.out_invoices_produit_defaut();

comment on function public.out_invoices_produit_defaut() is
  'Pose le produit d''une facture à sa création quand l''appelant ne l''a pas fait. Reprend les règles du rattrapage de db/161.';
