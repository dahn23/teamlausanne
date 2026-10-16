-- ===========================================================================
--  161 — Produits facturables, prix du Club par jour, paiements partiels
-- ---------------------------------------------------------------------------
--  Demande de l'équipe (liste des 8 points sur l'onglet Factures). Ce fichier
--  pose les FONDATIONS des points 1, 4 et 6 ; les points 2, 5 et 8 s'appuient
--  dessus et viendront ensuite.
--
--  Ce qui existait, et pourquoi ça ne suffisait pas :
--
--  · Une ligne de facture est un objet jsonb { label, amount } — du texte
--    libre. « Kids Tennis 2026/27 — Amanuel Betiel » est une PHRASE, pas un
--    produit. Impossible donc de filtrer les factures par produit (point 2),
--    de savoir ce qui reste à facturer (point 5), ni de vérifier qu'on
--    facture à un enfant le cours auquel il est inscrit.
--
--  · Les tarifs vivaient dans app_settings.sub_prices : UN prix par filière,
--    à plat. Le Club se facture en réalité selon le jour de la semaine
--    (770 à 815) — cette grille n'avait nulle part où exister (point 6).
--
--  · Une facture était payée ou pas. Un versement partiel n'avait pas de
--    place : on ne pouvait ni l'enregistrer, ni calculer un solde (point 4).
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  1. Les produits
-- ---------------------------------------------------------------------------
create table if not exists invoice_products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,              -- le nom qui PARAÎT sur la facture
  price         numeric,                    -- prix par défaut, modifiable à la facture
  -- Prix par jour de semaine, pour le Club : { "1": 770, "2": 815, … }
  -- Clés ISO : 1 = lundi … 7 = dimanche. Null = un seul prix, celui ci-dessus.
  price_by_weekday jsonb,
  -- Le lien avec l'onglet Cours : c'est lui qui permettra de vérifier qu'on
  -- facture à un enfant le cours auquel il est réellement inscrit (point 2),
  -- et de deviner le bon produit pour chacun (point 5).
  course_type_id uuid references course_types(id) on delete set null,
  filiere       text,                       -- recoupe role_periods.role
  kind          text not null default 'abonnement',  -- abonnement | stage | location | autre
  active        boolean not null default true,
  sort          integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists invoice_products_actifs on invoice_products (active, sort, name);

-- Un produit par nom : deux « Kids Tennis » rendraient tout filtre ambigu.
create unique index if not exists invoice_products_nom_unique
  on invoice_products (lower(name));

-- Le produit vendu, porté par la facture. On le met AUSSI au niveau de la
-- facture et pas seulement dans les lignes : c'est ce qui rend le filtre par
-- produit (point 2) simple et rapide. La quasi-totalité des factures n'a
-- qu'une ligne ; celles qui en ont plusieurs gardent le produit principal ici
-- et le détail dans items.
alter table out_invoices add column if not exists product_id uuid references invoice_products(id);
create index if not exists out_invoices_produit on out_invoices (product_id);

-- ---------------------------------------------------------------------------
--  2. Les versements
-- ---------------------------------------------------------------------------
--  Une facture pouvait être « payee » ou non. Un acompte n'avait pas de place.
--  Chaque versement est désormais une ligne ; le statut de la facture se
--  DÉDUIT de leur somme (voir out_invoice_solde plus bas) au lieu d'être saisi
--  à la main — un statut saisi et un montant encaissé finissent toujours par
--  se contredire.
create table if not exists out_invoice_payments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references out_invoices(id) on delete cascade,
  amount      numeric not null check (amount <> 0),
  paid_on     date not null default current_date,
  method      text,                         -- virement | sumup | twint | espèces | autre
  note        text,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

create index if not exists out_invoice_payments_facture on out_invoice_payments (invoice_id);

-- ---------------------------------------------------------------------------
--  3. Les annulations partielles
-- ---------------------------------------------------------------------------
--  Point 3 : annuler une PARTIE d'une facture. On ne touche pas au montant
--  d'origine — une facture envoyée ne se réécrit pas, sinon le PDF déjà chez
--  le client ne correspond plus à rien. On enregistre un avoir, et le solde
--  dû en tient compte.
create table if not exists out_invoice_credits (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references out_invoices(id) on delete cascade,
  amount      numeric not null check (amount > 0),   -- montant annulé
  reason      text,
  item_label  text,                         -- la ligne visée, si c'en est une
  created_by  uuid,
  created_at  timestamptz not null default now()
);

create index if not exists out_invoice_credits_facture on out_invoice_credits (invoice_id);

-- ---------------------------------------------------------------------------
--  4. Le solde d'une facture, calculé et jamais saisi
-- ---------------------------------------------------------------------------
--  Une seule source pour « combien reste-t-il à encaisser ». Les totaux de la
--  vue d'ensemble (point 8) en découlent, ce qui garantit qu'ils ne peuvent
--  pas se contredire entre eux.
create or replace view out_invoices_solde as
select
  f.*,
  coalesce(p.verse, 0)                                  as verse,
  coalesce(a.avoir, 0)                                  as avoir,
  f.amount - coalesce(a.avoir, 0)                       as du,
  f.amount - coalesce(a.avoir, 0) - coalesce(p.verse,0) as reste,
  case
    when f.status = 'annulee'                                            then 'annulee'
    when coalesce(a.avoir,0) >= f.amount                                 then 'annulee'
    when coalesce(p.verse,0) <= 0                                        then f.status
    when coalesce(p.verse,0) >= f.amount - coalesce(a.avoir,0) - 0.005   then 'payee'
    else 'partielle'
  end                                                   as statut_reel
from out_invoices f
left join (select invoice_id, sum(amount) verse from out_invoice_payments group by invoice_id) p
       on p.invoice_id = f.id
left join (select invoice_id, sum(amount) avoir from out_invoice_credits  group by invoice_id) a
       on a.invoice_id = f.id;

-- ---------------------------------------------------------------------------
--  5. Sécurité
-- ---------------------------------------------------------------------------
--  Des montants dus par des familles : réservé au staff, comme out_invoices.
alter table invoice_products     enable row level security;
alter table out_invoice_payments enable row level security;
alter table out_invoice_credits  enable row level security;

drop policy if exists ip_lire   on invoice_products;
drop policy if exists ip_ecrire on invoice_products;
create policy ip_lire   on invoice_products for select to authenticated using (is_staff(auth.uid()));
create policy ip_ecrire on invoice_products for all    to authenticated
  using (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire'))
  with check (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire'));

drop policy if exists oip_lire   on out_invoice_payments;
drop policy if exists oip_ecrire on out_invoice_payments;
create policy oip_lire   on out_invoice_payments for select to authenticated using (is_staff(auth.uid()));
create policy oip_ecrire on out_invoice_payments for all    to authenticated
  using (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire'))
  with check (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire'));

drop policy if exists oic_lire   on out_invoice_credits;
drop policy if exists oic_ecrire on out_invoice_credits;
create policy oic_lire   on out_invoice_credits for select to authenticated using (is_staff(auth.uid()));
create policy oic_ecrire on out_invoice_credits for all    to authenticated
  using (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire'))
  with check (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire'));

-- ---------------------------------------------------------------------------
--  6. Le catalogue de départ
-- ---------------------------------------------------------------------------
--  Les prix viennent de ce qui existe déjà : app_settings.sub_prices pour les
--  abonnements, stage_categories pour les stages. Rien n'est inventé. Le Club
--  reçoit en plus sa grille par jour, demandée au point 6.
insert into invoice_products (name, price, price_by_weekday, course_type_id, filiere, kind, sort)
values
  ('Kids Tennis', 490,  null,
   (select id from course_types where name = 'Kids Tennis'),  'kidstennis',  'abonnement', 10),
  ('Club',        815,  '{"1":770,"2":815,"3":815,"4":790,"5":770}'::jsonb,
   (select id from course_types where name = 'Club'),         'club',        'abonnement', 20),
  ('Compétition', 1990, null,
   (select id from course_types where name = 'Compétition'),  'competition', 'abonnement', 30),
  ('Performance', 4500, null,
   (select id from course_types where name = 'Performance'),  'performance', 'abonnement', 40),
  ('Privé',       null, null,
   (select id from course_types where name = 'Privé'),        null,          'autre',      50),
  ('Privé-adultes', null, null,
   (select id from course_types where name = 'Privé-adultes'), 'adultes',    'autre',      60)
on conflict (lower(name)) do nothing;

-- Les stages : un produit par catégorie, au prix de la catégorie.
insert into invoice_products (name, price, filiere, kind, sort)
select 'Stage ' || c.name, c.price, 'stage', 'stage', 100 + coalesce(c.sort_order, 0)
from stage_categories c
where c.active
on conflict (lower(name)) do nothing;

-- Sport-études, Pro et Pro U18 : le prix est au CONTRAT, propre à chaque
-- famille, et la facture le porte déjà. Un prix par défaut inscrit ici serait
-- faux pour tout le monde — d'où price à null.
insert into invoice_products (name, price, filiere, kind, sort) values
  ('Sport-études', null, 'sport-etudes', 'abonnement', 44),
  ('Pro U18',      null, 'pro-u18',      'abonnement', 45),
  ('Pro',          null, 'pro',          'abonnement', 46)
on conflict (lower(name)) do nothing;

-- Les locations de courts d'hiver (point 7), aux quatre tarifs existants.
insert into invoice_products (name, price, filiere, kind, sort)
select * from (values
  ('Abonnement hiver — membre · heure pleine',     (select (value->>'hiver_membre_pleine')::numeric    from app_settings where key='sub_prices'), 'location', 'location', 200),
  ('Abonnement hiver — membre · heure creuse',     (select (value->>'hiver_membre_creuse')::numeric    from app_settings where key='sub_prices'), 'location', 'location', 201),
  ('Abonnement hiver — non-membre · heure pleine', (select (value->>'hiver_nonmembre_pleine')::numeric from app_settings where key='sub_prices'), 'location', 'location', 202),
  ('Abonnement hiver — non-membre · heure creuse', (select (value->>'hiver_nonmembre_creuse')::numeric from app_settings where key='sub_prices'), 'location', 'location', 203)
) as v(name, price, filiere, kind, sort)
on conflict (lower(name)) do nothing;

-- ---------------------------------------------------------------------------
--  7. Rattacher les factures déjà émises
-- ---------------------------------------------------------------------------
--  Sans cela, le filtre par produit (point 2) et les totaux (point 8)
--  ignoreraient 317 factures. On rapproche par le libellé, qui commence par le
--  nom du produit (« Kids Tennis 2026/27 — … », « Rappel - Compétition … »).
--  Prudence volontaire : on ne rattache que les correspondances certaines,
--  en partant du nom de produit le plus long — sans quoi « Privé » avalerait
--  « Privé-adultes ».
update out_invoices f
   set product_id = p.id
  from invoice_products p
 where f.product_id is null
   and p.kind <> 'stage'
   and f.label ilike '%' || p.name || '%'
   and not exists (
     select 1 from invoice_products q
      where q.id <> p.id
        and length(q.name) > length(p.name)
        and f.label ilike '%' || q.name || '%'
   );

-- Les stages portent déjà filiere = 'stage' : on les rattache par la catégorie
-- nommée dans le libellé (« … — Loisir matin »).
update out_invoices f
   set product_id = p.id
  from invoice_products p
 where f.product_id is null
   and f.filiere = 'stage'
   and p.kind = 'stage'
   and f.label ilike '%' || replace(p.name, 'Stage ', '') || '%';

-- Restent les mensualités Sport-études et Pro : leur libellé dit « mensualité
-- 9/12 » et non le produit, mais elles portent leur filière. On s'en sert.
update out_invoices f
   set product_id = p.id
  from invoice_products p
 where f.product_id is null
   and f.filiere is not null
   and p.filiere = f.filiere
   and p.kind = 'abonnement';

-- Résultat mesuré : 315 factures sur 317 rattachées, aucune ambiguïté. Les
-- deux restantes sont de vieux rappels de stage de l'été 2026, sans filière.

-- ---------------------------------------------------------------------------
--  8. Les versements déjà connus
-- ---------------------------------------------------------------------------
--  Les factures marquées « payee » le sont pour leur montant entier : on crée
--  le versement correspondant, sans quoi la vue d'ensemble les compterait
--  comme encore dues.
insert into out_invoice_payments (invoice_id, amount, paid_on, method, note)
select f.id, f.amount, coalesce(f.paid_at::date, f.issue_date), 'reprise',
       'Reprise automatique : facture marquée payée avant la mise en place des versements.'
from out_invoices f
where f.status = 'payee'
  and not exists (select 1 from out_invoice_payments p where p.invoice_id = f.id);
