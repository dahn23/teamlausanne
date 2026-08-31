-- 18_push_notifications.sql
-- Notifications push (Web Push / VAPID) pour la messagerie de la console.
-- Envoi depuis l'edge function mail-cron (npm:web-push) au staff a chaque nouveau mail.

-- Abonnements Web Push (un par appareil/navigateur d'un utilisateur staff).
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  ua text,
  created_at timestamptz default now()
);
alter table public.push_subscriptions enable row level security;
-- Chacun gere SES propres abonnements ; le serveur (service_role) les lit tous pour envoyer.
drop policy if exists ps_self on public.push_subscriptions;
create policy ps_self on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Cles VAPID cote serveur uniquement (RLS activee SANS policy => illisible client, comme lo_secret).
-- La cle PUBLIQUE est aussi en dur dans admin.js (VAPID_PUBLIC) : c'est public, sans risque.
create table if not exists public.push_config (
  id int primary key default 1,
  public_key text not null,
  private_key text not null,
  subject text not null default 'mailto:info@teamlausanne.ch',
  constraint push_config_single check (id = 1)
);
alter table public.push_config enable row level security;
-- Les cles sont inserees une fois (generees via web-push.generateVAPIDKeys()).
-- (valeurs reelles posees a l'application de la migration ; non re-committees ici.)
