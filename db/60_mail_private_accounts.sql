-- 60_mail_private_accounts.sql
-- Messagerie : boîtes PRIVÉES. Une boîte peut être rattachée à un utilisateur
-- (mail_accounts.private_user_id) : seuls cet utilisateur et les superadmins voient
-- ses mails, ses pièces jointes et la boîte elle-même dans la console. Les boîtes
-- partagées (private_user_id null) restent visibles par tout le staff comme avant.
-- Première boîte privée : raphael@teamlausanne.ch → Raphael (admin) + Dan (superadmin).
-- Côté edge functions : mail-send et mail-import-box refusent une boîte privée à
-- quelqu'un d'autre ; mail-cron ne pousse les notifications que vers les bonnes personnes.

alter table public.mail_accounts
  add column if not exists private_user_id uuid references auth.users(id) on delete set null;
comment on column public.mail_accounts.private_user_id is
  'Boîte privée : seul cet utilisateur (et les superadmins) voient ses mails. Null = boîte partagée du staff.';

-- Visibilité d'une adresse de boîte pour un utilisateur. Adresse inconnue = visible (comportement d'avant).
create or replace function public.mail_can_see(p_address text, uid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select a.private_user_id is null
        or a.private_user_id = uid
        or public.has_role(uid, 'superadmin'::app_role)
    from public.mail_accounts a
    where lower(a.address) = lower(coalesce(p_address, ''))
    limit 1
  ), true);
$$;
grant execute on function public.mail_can_see(text, uuid) to authenticated;

drop policy if exists mail_acc_staff on public.mail_accounts;
create policy mail_acc_staff on public.mail_accounts for all
  using (is_staff(auth.uid()) and (private_user_id is null or private_user_id = auth.uid() or has_role(auth.uid(), 'superadmin'::app_role)))
  with check (is_staff(auth.uid()) and (private_user_id is null or private_user_id = auth.uid() or has_role(auth.uid(), 'superadmin'::app_role)));

drop policy if exists mail_msg_staff on public.mail_messages;
create policy mail_msg_staff on public.mail_messages for all
  using (is_staff(auth.uid()) and mail_can_see(account_address, auth.uid()))
  with check (is_staff(auth.uid()) and mail_can_see(account_address, auth.uid()));

drop policy if exists mail_att_staff on public.mail_attachments;
create policy mail_att_staff on public.mail_attachments for all
  using (is_staff(auth.uid()) and exists (
    select 1 from public.mail_messages m
    where m.id = mail_attachments.mail_id and mail_can_see(m.account_address, auth.uid())))
  with check (is_staff(auth.uid()) and exists (
    select 1 from public.mail_messages m
    where m.id = mail_attachments.mail_id and mail_can_see(m.account_address, auth.uid())));

-- La boîte de Raphael, rattachée à son compte.
insert into public.mail_accounts (address, label, is_hub, active, sort_order, private_user_id)
select 'raphael@teamlausanne.ch', 'Raphael', false, true, 50, u.id
from auth.users u
where u.email = 'raphael@teamlausanne.ch'
  and not exists (select 1 from public.mail_accounts a where a.address = 'raphael@teamlausanne.ch');
update public.mail_accounts a set private_user_id = u.id
from auth.users u
where a.address = 'raphael@teamlausanne.ch' and u.email = 'raphael@teamlausanne.ch' and a.private_user_id is null;
