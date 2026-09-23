-- Envoi automatique des factures, le 20 de chaque mois.
--
-- Le 20 à 06:00 UTC — 08:00 en heure d'été, 07:00 en hiver. pg_cron ne connaît
-- que l'UTC ; une heure de décalage sur un envoi de factures est sans
-- conséquence, alors qu'une expression « à l'heure suisse » n'existe pas ici.
--
-- La fonction n'envoie que les factures « à envoyer » dont la DATE D'ÉMISSION
-- est arrivée. Le 20 octobre, elle expédiera donc les échéances dues le 30
-- octobre, et rien de ce qui vient après : le calendrier est porté par les
-- factures elles-mêmes, pas par la tâche.
--
-- Une facture déjà envoyée à la main est en statut « envoyée » : la tâche ne la
-- reprend pas. Les onze doubles d'ouverture, envoyées manuellement en
-- septembre, ne repartiront donc pas le 20 octobre.

select cron.schedule(
  'factures-le-20',
  '0 6 20 * *',
  $$
  select net.http_post(
    url := 'https://lnrmtwamuaqcubohontn.supabase.co/functions/v1/out-invoices-cron?key=cc3bcc914b0345cf805d7186604777a0',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);
