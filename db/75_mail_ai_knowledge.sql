-- 75_mail_ai_knowledge.sql
-- « Proposer une réponse » (messagerie) : fiche de connaissances que l'IA reçoit à chaque brouillon.
-- Sans elle, l'IA ne connaît ni les tarifs ni qui fait quoi, et répond « contactez-nous ».
-- Une seule ligne (id = 1), modifiable dans la console par le secrétariat et les admins.
create table if not exists public.mail_ai_knowledge (
  id smallint primary key default 1 check (id = 1),
  body text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.mail_ai_knowledge enable row level security;
drop policy if exists mak_rw on public.mail_ai_knowledge;
create policy mak_rw on public.mail_ai_knowledge for all to authenticated
  using (exists (select 1 from user_roles where user_id = auth.uid() and role in ('superadmin','admin','secretaire')))
  with check (exists (select 1 from user_roles where user_id = auth.uid() and role in ('superadmin','admin','secretaire')));
grant select, insert, update on public.mail_ai_knowledge to authenticated;
-- Le texte de départ (tiré du site public) est inséré par la migration Supabase du même nom.
