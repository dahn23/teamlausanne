-- 144 — Le chatbot du site public : tables, droits, rétention.
--
-- Étape 1 d'un chantier en sept. Rien ici n'est public : le site parle à une
-- edge function, jamais à ces tables. L'anon n'a donc AUCUN droit dessus, et
-- `/chatbot/config` lui-même passe par la fonction, qui lit en service role.
-- C'est ce qui permet de garder le réglage (modèle, plafond, prompt) hors de
-- portée d'un visiteur tout en le servant au widget.
--
-- `can_chatbot` plutôt que `is_staff` : régler un bot public, c'est écrire au
-- nom du club. Même périmètre que la newsletter — direction et secrétariat.

create or replace function public.can_chatbot(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role in ('superadmin','admin','secretaire'));
$$;

-- ---------------------------------------------------------------------------
-- Réglages : une seule ligne, forcée par la contrainte sur l'id.

create table if not exists public.bot_settings (
  id              int primary key default 1 check (id = 1),
  actif           boolean not null default false,   -- false : le site n'affiche rien
  modele          text    not null default 'claude-haiku-5-5',
  effort          text    not null default 'low',
  plafond_jour    int     not null default 300,     -- questions par jour, tout le site
  accueil         text    not null default 'Bonjour ! Une question sur l''académie, les cours ou les stages ? Je suis là pour ça.',
  suggestions     text[]  not null default array[
                    'Quels cours pour un enfant de 7 ans ?',
                    'Combien coûte une saison ?',
                    'Quand ont lieu les prochains stages ?',
                    'Comment inscrire mon enfant ?'],
  prompt          text    not null default '',      -- rempli au premier déploiement
  updated_at      timestamptz not null default now(),
  updated_by      uuid
);
insert into public.bot_settings (id) values (1) on conflict (id) do nothing;

-- Historique du prompt. On en garde 30 : de quoi revenir sur un mauvais
-- réglage sans faire grossir la table indéfiniment.
create table if not exists public.bot_prompt_versions (
  id          uuid primary key default gen_random_uuid(),
  prompt      text not null,
  created_at  timestamptz not null default now(),
  created_by  uuid
);
create index if not exists bot_prompt_versions_date on public.bot_prompt_versions (created_at desc);

-- ---------------------------------------------------------------------------
-- Conversations et messages.
--
-- ip_hash et non l'IP : il sert à limiter le débit, pas à identifier. Il est
-- effacé au bout de 30 jours (voir bot_purge), bien avant la conversation
-- elle-même. C'est ce que dit la politique de confidentialité.

create table if not exists public.bot_conversations (
  id          uuid primary key default gen_random_uuid(),
  started_at  timestamptz not null default now(),
  last_at     timestamptz not null default now(),
  ip_hash     text,
  page        text,                                   -- la page d'où part la question
  n_questions int not null default 0,
  cost_usd    numeric not null default 0,
  is_test     boolean not null default false           -- bac à sable : hors statistiques
);
create index if not exists bot_conv_date on public.bot_conversations (started_at desc);
create index if not exists bot_conv_ip   on public.bot_conversations (ip_hash, started_at desc);

create table if not exists public.bot_messages (
  id              bigserial primary key,
  conversation_id uuid not null references public.bot_conversations(id) on delete cascade,
  idx             int not null,                        -- position dans le fil
  role            text not null check (role in ('user','assistant')),
  content         text not null default '',
  tools           jsonb not null default '[]'::jsonb,  -- pages lues, questions signalées
  usage           jsonb not null default '{}'::jsonb,  -- jetons, par catégorie
  cost_usd        numeric not null default 0,
  feedback        smallint not null default 0 check (feedback between -1 and 1),
  unanswered      boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (conversation_id, idx)
);
create index if not exists bot_msg_date   on public.bot_messages (created_at desc);
create index if not exists bot_msg_sansrep on public.bot_messages (created_at desc) where unanswered;
create index if not exists bot_msg_pouce  on public.bot_messages (created_at desc) where feedback <> 0;

-- ---------------------------------------------------------------------------
-- Évaluation.
--
-- `statut` passe à « interrompue » au démarrage du serveur : un déploiement
-- Netlify ou un redémarrage tue la tâche de fond, et sans ça le bouton reste
-- bloqué pour toujours sur « en cours ».

create table if not exists public.bot_evals (
  id          uuid primary key default gen_random_uuid(),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  statut      text not null default 'en_cours' check (statut in ('en_cours','terminee','interrompue')),
  modele      text not null,
  juge        text not null default 'claude-opus-5-5',
  n_total     int not null default 0,
  n_faites    int not null default 0,
  score       jsonb not null default '{}'::jsonb,
  cost_usd    numeric not null default 0,
  created_by  uuid
);
create index if not exists bot_evals_date on public.bot_evals (started_at desc);

create table if not exists public.bot_eval_items (
  id           bigserial primary key,
  eval_id      uuid not null references public.bot_evals(id) on delete cascade,
  categorie    text not null,
  question     text not null,
  attendu      text,
  reponse      text,
  verdict      text check (verdict in ('correct','partiel','faux','erreur')),
  explication  text,
  amelioration text,
  par_code     boolean not null default false,   -- noté par le code, sans IA
  created_at   timestamptz not null default now()
);
create index if not exists bot_eval_items_eval on public.bot_eval_items (eval_id, id);

-- ---------------------------------------------------------------------------
-- Droits. Lecture et écriture réservées à can_chatbot ; aucune policy pour
-- anon ni pour un membre connecté. L'edge function travaille en service role,
-- qui passe outre RLS — c'est voulu, c'est elle la seule porte publique.

alter table public.bot_settings        enable row level security;
alter table public.bot_prompt_versions enable row level security;
alter table public.bot_conversations   enable row level security;
alter table public.bot_messages        enable row level security;
alter table public.bot_evals           enable row level security;
alter table public.bot_eval_items      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['bot_settings','bot_prompt_versions','bot_conversations',
                           'bot_messages','bot_evals','bot_eval_items'] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (can_chatbot(auth.uid())) with check (can_chatbot(auth.uid()))',
      t || '_staff', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Rétention. Appelée par un cron quotidien (posé à l'étape 3, avec la
-- fonction) : l'empreinte d'IP part à 30 jours, la conversation à un an.

create or replace function public.bot_purge() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ip int; v_conv int;
begin
  update bot_conversations set ip_hash = null
   where ip_hash is not null and started_at < now() - interval '30 days';
  get diagnostics v_ip = row_count;
  delete from bot_conversations where started_at < now() - interval '1 year';
  get diagnostics v_conv = row_count;
  return jsonb_build_object('ip_effacees', v_ip, 'conversations_supprimees', v_conv);
end $$;
revoke all on function public.bot_purge() from public, anon, authenticated;

-- Contrôle : aucune de ces tables ne doit être lisible par anon.
--   select tablename, roles, cmd from pg_policies
--    where schemaname='public' and tablename like 'bot_%';
