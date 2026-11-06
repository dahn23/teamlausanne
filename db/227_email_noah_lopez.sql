-- 227 — l'adresse de Noah Lopez (pro) sur sa fiche (06.11.2026)
--
-- Sa fiche était la seule des 17 jeunes élite de la saison courante à n'avoir
-- aucun e-mail. newsletter_audience() ignore en silence une fiche sans adresse
-- (« p.email is not null ») : il aurait été le seul joueur du premier envoi à
-- ne rien recevoir, sans que rien ne le signale.
--
-- Adresse donnée par Raphael. Vérifié avant : libre dans people et auth.users.
-- Après : les 17 fiches élite ont une adresse, aucune désinscrite.

update people
set email = 'noahlopez@bluewin.ch'
where id = 'eb8d0af1-1b3a-44b2-a808-6550c701144a'   -- Noah Lopez
  and email is null;
