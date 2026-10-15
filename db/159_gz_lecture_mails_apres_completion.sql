-- 159 — GameZone : la lecture automatique des mails SumUp / Twint repart (15.10.2026).
-- Depuis mail-cron v42 (13.10), un mail reçu est d'abord enregistré comme « ligne d'attente » vide, puis complété
-- une fois décodé. Le déclencheur ne réagissait qu'à la création : il lisait la ligne vide, et le relevé SumUp du
-- 13.10 (week-end du 10.10 : 660.00 brut, 11.04 de frais, 648.96 versé) n'est jamais arrivé dans le rapprochement.
-- Désormais il réagit aussi quand le texte du mail est complété. Les deux lectures ignorent un mail déjà compté.

drop trigger if exists trg_gz_mail_settlement on public.mail_messages;
create trigger trg_gz_mail_settlement
  after insert or update of body_text, body_html on public.mail_messages
  for each row execute function gz_mail_settlement_trg();

-- Rattrapage des mails reçus depuis la v42.
select gz_ingest_sumup_mail(id), gz_ingest_twint_mail(id) from mail_messages
 where account_address = 'info@teamlausanne.ch' and direction is distinct from 'out'
   and received_at >= '2026-10-13' and (from_address ilike '%sumup.com%' or from_address ilike '%twint%');
