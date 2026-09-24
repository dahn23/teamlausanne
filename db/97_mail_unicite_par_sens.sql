-- Messagerie : l'unicité d'un mail se juge par identifiant ET par sens.
--
-- Un mail écrit depuis la console vers une de nos propres boîtes (un essai de
-- facture envoyé à info@ ou raphael@) existe pour de bon en DEUX exemplaires :
-- celui des Envoyés et celui livré dans la boîte de réception. Même identifiant
-- Message-ID, deux lignes légitimes — exactement ce que montre n'importe quel
-- logiciel de courrier.
--
-- L'index unique portait sur le seul message_id : la copie reçue était refusée
-- par la base. Et comme la relève n'examine pas le résultat de son insertion,
-- le refus passait inaperçu — l'essai partait, mais n'arrivait jamais dans la
-- Messagerie. Un essai vers une adresse extérieure (Gmail) ne posait pas de
-- problème : il n'y a rien à relever chez Gmail.
--
-- Deux index identiques coexistaient (mail_messages_msgid_uidx et
-- uniq_mail_message_id) : on n'en garde qu'un, élargi au sens.
drop index if exists public.mail_messages_msgid_uidx;
drop index if exists public.uniq_mail_message_id;

create unique index if not exists mail_messages_msgid_sens_uidx
  on public.mail_messages (message_id, direction)
  where message_id is not null;
