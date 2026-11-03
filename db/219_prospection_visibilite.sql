-- 219_prospection_visibilite.sql
-- Prospects › Visibilité : la prospection « où peut-on parler de nous ? ».
--
-- Rien à voir avec les autres sous-onglets de Prospects, qui suivent des
-- JOUEURS. Ici on suit des ORGANISATIONS : sites web, annuaires, plateformes,
-- associations, événements, écoles, commerces, médias — tout endroit où
-- l'académie pourrait gagner en visibilité. Travail confié à Arsalan et
-- Céline, relu chaque semaine en réunion d'équipe.
--
-- Deux tables, la même forme que le suivi des familles (db/48, db/207) :
--   · visibility_leads   — une piste = une organisation + son contact ;
--   · visibility_events  — l'historique daté des échanges.
-- Ce découpage est VOLONTAIRE : un champ « où ça en est » réécrit à chaque
-- appel perd tout ce qui avait été dit la fois d'avant. C'est exactement
-- l'erreur corrigée en db/207 pour les familles ; on ne la refait pas.

create table if not exists public.visibility_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,

  -- qui / quoi
  org text,                                   -- le nom de l'organisation (ou du site, ou de l'événement)
  kind text not null default 'autre'
    check (kind in ('site','annuaire','plateforme','reseau','media','association',
                    'club','ecole','commerce','entreprise','institution','evenement','autre')),
  website text,
  location text,                              -- ville / région

  -- la personne à qui l'on parle
  first_name text,
  last_name text,
  fonction text,
  email text,
  phone text,

  -- où ça en est
  stage text not null default 'a_contacter'
    check (stage in ('a_contacter','contacte','discussion','proposition',
                     'accord','refus','sans_suite')),
  stage_changed_at timestamptz not null default now(),
  priorite text not null default 'tiede' check (priorite in ('chaud','tiede','froid')),
  owner text,                                 -- qui s'en occupe (prénom, saisi libre)

  -- la substance
  opportunite text,                           -- ce qu'on pourrait y faire
  proposition text,                           -- ce qui a été proposé, ou l'accord conclu
  montant numeric(10, 2),                     -- coût ou valeur, en francs, si chiffré

  -- la suite
  next_action text,
  next_action_at date,
  last_contact date,

  done boolean not null default false         -- archivé (hors de l'entonnoir)
);

create index if not exists visibility_leads_next on public.visibility_leads(next_action_at) where not done;
create index if not exists visibility_leads_stage on public.visibility_leads(stage) where not done;

create table if not exists public.visibility_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.visibility_leads(id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null default 'note'
    check (kind in ('note','appel','mail','linkedin','rdv','visite','proposition','etape')),
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists visibility_events_lead on public.visibility_events(lead_id, at desc);

-- --- accès ----------------------------------------------------------------
-- Volontairement PLUS LARGE que les autres sous-onglets de Prospects : le
-- secrétariat doit pouvoir y écrire, puisque c'est lui qui fait le travail.
-- Mais pas is_staff() — qui inclut les moniteurs (cf. note mémoire sur le
-- modèle de droits) : une liste de contacts d'entreprises n'a aucune raison
-- d'être ouverte à tout l'encadrement.
alter table public.visibility_leads  enable row level security;
alter table public.visibility_events enable row level security;

drop policy if exists vl_staff on public.visibility_leads;
create policy vl_staff on public.visibility_leads for all
  using (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire') or has_role(auth.uid(), 'head_coach'))
  with check (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire') or has_role(auth.uid(), 'head_coach'));

drop policy if exists ve_staff on public.visibility_events;
create policy ve_staff on public.visibility_events for all
  using (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire') or has_role(auth.uid(), 'head_coach'))
  with check (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire') or has_role(auth.uid(), 'head_coach'));

grant select, insert, update, delete on public.visibility_leads  to authenticated;
grant select, insert, update, delete on public.visibility_events to authenticated;
