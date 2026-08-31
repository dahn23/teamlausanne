-- 19_mail_pushed_flag.sql
-- Fiabilise les notifs push : colonne mail_messages.pushed. Avant, mail-cron ne notifiait
-- que les mails inseres DANS le meme passage -> un mail recupere a un autre moment (ou par
-- la releve manuelle mail-fetch) n'etait jamais notifie (vu comme "deja connu" ensuite).
-- Desormais mail-cron (v11) sendPush() notifie TOUT entrant pushed=false et frais (<2h),
-- puis marque pushed=true. Independant de qui/quand a insere le mail.
alter table public.mail_messages add column if not exists pushed boolean not null default false;
-- Historique = ne pas notifier retroactivement.
update public.mail_messages set pushed = true where direction = 'in';
