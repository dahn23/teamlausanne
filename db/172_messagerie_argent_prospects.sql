-- ===================================================================
--  SÉCURITÉ : la messagerie, l'argent et le recrutement (16.10.2026)
-- ===================================================================
-- db/171 a sorti les moniteurs d'is_staff(). Mais le même trou restait d'un
-- cran plus haut : mesuré avec un compte COACH ordinaire, il lisait encore
--
--   mail_messages         6 249   toute la correspondance d'info@
--   prospects             4 543   le fichier de recrutement
--   out_invoice_payments     28   qui a payé quoi
--   coach_rates              22   le tarif horaire de ses collègues
--
-- Or la matrice d'accès d'admin.js est sans ambiguïté sur ce point :
--
--   coach          : cours, social, matchs, lastscores, plantournois,
--                    phystests, physique, heures
--   coach_physique : cours, social, phystests, physique, heures
--
-- Ni « mail », ni « factures », ni « prospects ». L'interface ne le leur
-- propose nulle part — seule la base l'autorisait encore. On aligne donc la
-- base sur la matrice, pour les trois domaines où elle ne laisse aucune place
-- au doute.
--
-- Les prédicats reprennent exactement les rôles qui ont l'onglet :
--   onglet « mail »      → superadmin, admin, secretaire, organisateur
--   onglet « prospects » → superadmin, admin, head_coach
--   onglet « factures »  → can_billing(), déjà en place
--
-- ⚠️ CE QUI N'EST PAS FAIT ICI, et pourquoi. Aligner les 110 policies sur les
-- 33 onglets et 11 rôles est une refonte du modèle de droits, pas un verrou :
-- elle change ce que les coachs peuvent faire au quotidien, et elle demande
-- d'être relue puis essayée sur une préview avant d'atterrir en production.
-- Ce fichier s'arrête donc aux trois domaines sans zone grise.

-- ---- Les portes ----------------------------------------------------
create or replace function public.can_mail(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
     and role in ('superadmin','admin','secretaire','organisateur'));
$$;
revoke all on function public.can_mail(uuid) from public, anon;
grant execute on function public.can_mail(uuid) to authenticated;
comment on function public.can_mail(uuid) is
  'Rôles ayant l''onglet Messagerie dans admin.js (DEFAULT_TAB_ACCESS).';

create or replace function public.can_prospects(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
     and role in ('superadmin','admin','head_coach'));
$$;
revoke all on function public.can_prospects(uuid) from public, anon;
grant execute on function public.can_prospects(uuid) to authenticated;
comment on function public.can_prospects(uuid) is
  'Rôles ayant l''onglet Prospects dans admin.js (DEFAULT_TAB_ACCESS).';

-- ---- La messagerie -------------------------------------------------
-- Les policies « official » (tournoi@ pour les organisateurs) restent telles
-- quelles : elles sont déjà étroites, et can_mail les couvre de toute façon.
alter policy mail_msg_staff   on public.mail_messages
  using (can_mail(auth.uid()) and mail_can_see(account_address, auth.uid()))
  with check (can_mail(auth.uid()) and mail_can_see(account_address, auth.uid()));

alter policy mail_att_staff   on public.mail_attachments
  using (can_mail(auth.uid()) and exists (
    select 1 from mail_messages m
     where m.id = mail_attachments.mail_id and mail_can_see(m.account_address, auth.uid())))
  with check (can_mail(auth.uid()) and exists (
    select 1 from mail_messages m
     where m.id = mail_attachments.mail_id and mail_can_see(m.account_address, auth.uid())));

alter policy mail_draft_staff on public.mail_drafts
  using (can_mail(auth.uid())) with check (can_mail(auth.uid()));

alter policy mail_acc_staff   on public.mail_accounts
  using (can_mail(auth.uid()) and (private_user_id is null or private_user_id = auth.uid()
         or has_role(auth.uid(), 'superadmin')))
  with check (can_mail(auth.uid()) and (private_user_id is null or private_user_id = auth.uid()
         or has_role(auth.uid(), 'superadmin')));

-- mail_compose_drafts : chacun ses brouillons, et seulement si la messagerie
-- lui est ouverte.
alter policy mcd_own on public.mail_compose_drafts
  using (created_by = auth.uid() and can_mail(auth.uid()))
  with check (created_by = auth.uid() and can_mail(auth.uid()));

-- ---- Le recrutement ------------------------------------------------
alter policy prospects_staff        on public.prospects
  using (can_prospects(auth.uid())) with check (can_prospects(auth.uid()));
alter policy prospect_matches_staff on public.prospect_matches
  using (can_prospects(auth.uid())) with check (can_prospects(auth.uid()));

-- ---- L'argent ------------------------------------------------------
-- Même porte que les factures elles-mêmes : un versement et la facture qu'il
-- solde ne doivent pas avoir deux règles différentes.
alter policy oip_lire on public.out_invoice_payments using (can_billing(auth.uid()));
alter policy oic_lire on public.out_invoice_credits  using (can_billing(auth.uid()));
alter policy "runs lisibles par le staff" on public.out_invoice_runs
  using (can_billing(auth.uid()));

-- Le tarif horaire : la paie, ou le sien (policy coach_rates_self de db/171).
alter policy coach_rates_staff on public.coach_rates
  using (can_payroll(auth.uid())) with check (can_payroll(auth.uid()));

-- Les messages du formulaire de contact : secrétariat et direction.
alter policy cm_read on public.contact_messages
  using (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire'));
