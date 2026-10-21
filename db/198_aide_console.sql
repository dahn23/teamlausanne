-- ---------------------------------------------------------------------------
-- L'AIDE DE LA CONSOLE — le bot qui explique où cliquer.
--
-- À ne pas confondre avec l'assistant du SITE (bot_*, db/144) : celui-là parle
-- aux visiteurs et ne connaît que les pages publiques. Celui-ci parle à
-- l'équipe et ne connaît que `docs/guide-console.md`. Deux publics, deux
-- sources, deux jeux de tables — les mélanger reviendrait à risquer qu'un
-- visiteur lise le mode d'emploi du secrétariat.
--
-- CE QU'IL NE FAIT PAS, et c'est le cœur du dessin : il ne lit AUCUNE donnée
-- de l'académie. Pas de people, pas de factures, pas de cours. Il explique le
-- chemin, jamais le contenu. « Où vois-je les heures de Mark ? » reçoit le
-- chemin vers l'écran ; le chiffre, c'est l'écran qui le donne.
-- ---------------------------------------------------------------------------

-- --- Qui a le droit --------------------------------------------------------
--
-- Poser une question : tout compte de la console. `is_staff` ne suffit pas —
-- il laisse dehors `prof` et `coach_mental`, qui utilisent la console comme
-- les autres. On prend donc « a au moins un rôle », en excluant `affichage` :
-- c'est l'écran du hall, sans surveillance, et une fenêtre de chat n'a rien
-- à y faire.
create or replace function public.can_aide(uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from user_roles where user_id = uid and role <> 'affichage'
  );
$$;

-- Lire le suivi (qui a demandé quoi, ce que le guide ne couvre pas) :
-- administrateurs seulement. La rubrique sera visible par tous, son contenu
-- non — c'est ce que dit le plan, et c'est le serveur qui tranche.
create or replace function public.can_aide_suivi(uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.is_admin(uid);
$$;

-- --- Les conversations -----------------------------------------------------
create table if not exists public.aide_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  started_at  timestamptz not null default now(),
  last_at     timestamptz not null default now(),
  n_questions int not null default 0,
  cost_usd    numeric not null default 0,
  -- Les écrans traversés, pour voir d'où partent les questions sans avoir à
  -- rouvrir chaque fil.
  ecrans      text[] not null default '{}'
);
create index if not exists aide_conv_date on public.aide_conversations (started_at desc);
create index if not exists aide_conv_user on public.aide_conversations (user_id, started_at desc);

create table if not exists public.aide_messages (
  id              bigserial primary key,
  conversation_id uuid not null references public.aide_conversations(id) on delete cascade,
  idx             int not null,
  role            text not null check (role in ('user','assistant')),
  content         text not null default '',
  -- L'écran d'où part la question, au format des titres du guide :
  -- « Factures → À générer ». C'est ce qui permet de savoir quel écran
  -- mériterait d'être mieux documenté.
  ecran           text,
  tools           jsonb not null default '[]'::jsonb,
  usage           jsonb not null default '{}'::jsonb,
  cost_usd        numeric not null default 0,
  -- Le modèle a dû répondre « ce n'est pas dans le guide » : c'est la boucle
  -- d'amélioration, la seule colonne qu'on relit vraiment.
  hors_guide      boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (conversation_id, idx)
);
create index if not exists aide_msg_date on public.aide_messages (created_at desc);
create index if not exists aide_msg_hors on public.aide_messages (created_at desc) where hors_guide;

-- --- RLS -------------------------------------------------------------------
--
-- Aucune policy d'ÉCRITURE : tout passe par l'edge function, qui écrit avec la
-- clé de service. Lecture réservée aux administrateurs, via can_aide_suivi.
-- Une conversation contient les questions d'un collègue : c'est le genre de
-- chose qu'on ne laisse pas lire à tout le monde.
alter table public.aide_conversations enable row level security;
alter table public.aide_messages      enable row level security;

drop policy if exists aide_conv_lecture on public.aide_conversations;
create policy aide_conv_lecture on public.aide_conversations
  for select to authenticated using (public.can_aide_suivi(auth.uid()));

drop policy if exists aide_msg_lecture on public.aide_messages;
create policy aide_msg_lecture on public.aide_messages
  for select to authenticated using (public.can_aide_suivi(auth.uid()));

comment on table public.aide_conversations is
  'Aide de la console : un fil de questions posées par un membre de l''équipe.';
comment on table public.aide_messages is
  'Aide de la console : questions et réponses, avec l''écran d''origine.';
