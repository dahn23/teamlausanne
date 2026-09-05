-- 27_mail_compose_drafts.sql
-- Brouillons de « Nouveau message » (distincts de mail_drafts qui sont les brouillons de REPONSE).
-- Chaque membre du staff ne voit que SES brouillons.
create table if not exists public.mail_compose_drafts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid(),
  account text, to_addr text, cc text, bcc text, subject text, body_html text,
  updated_at timestamptz not null default now()
);
alter table public.mail_compose_drafts enable row level security;
drop policy if exists mcd_own on public.mail_compose_drafts;
create policy mcd_own on public.mail_compose_drafts for all
  using (created_by = auth.uid() and is_staff(auth.uid()))
  with check (created_by = auth.uid() and is_staff(auth.uid()));
grant select, insert, update, delete on public.mail_compose_drafts to authenticated;
