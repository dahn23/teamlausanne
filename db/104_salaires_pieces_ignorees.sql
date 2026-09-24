-- Salaires : pièces jointes de la fiduciaire écartées à la main (24.09.2026)
--
-- L'encadré des salaires proposait « Lire et importer » sur TOUT PDF venant de
-- @fimisa.ch. La fiduciaire n'envoie pas que des salaires : une « Situation
-- 2026 avec JW Academy » était proposée comme fichier de salaires — et un clic
-- aurait rempli les fiches de n'importe quoi.
--
-- Deux garde-fous : on ne met en avant que ce dont le nom de fichier ou le
-- sujet parle de salaire/paie/Lohn (le reste est rangé sous un repli, lisible
-- mais pas proposé), et ce registre permet d'écarter définitivement une pièce
-- que le repérage n'attrape pas.
create table if not exists public.sal_mail_ignored (
  att_id     uuid primary key,
  mail_id    uuid,
  filename   text,
  ignored_at timestamptz not null default now(),
  ignored_by uuid
);
alter table public.sal_mail_ignored enable row level security;
drop policy if exists smi_finance on public.sal_mail_ignored;
create policy smi_finance on public.sal_mail_ignored for all
  using (can_finance(auth.uid())) with check (can_finance(auth.uid()));
grant select, insert, delete on public.sal_mail_ignored to authenticated;
