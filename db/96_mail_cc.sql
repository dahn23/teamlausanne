-- Messagerie : les destinataires en copie (Cc) des mails reçus et envoyés (23.09.2026).
-- Texte libre « Nom <adresse>, … », rempli par mail-cron (v27) et mail-rescue ; affiché dans la console.
alter table public.mail_messages add column if not exists cc_address text;
