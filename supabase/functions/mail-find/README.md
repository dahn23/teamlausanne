# mail-find (edge function de diagnostic / rattrapage)

Cherche des mails dans « Tous les messages » de la boîte hub Gmail et importe des UIDs précis
dans `mail_messages` (+ pièces jointes). Auth par clé d'import (`gz_config.import_key`), pas de JWT.

- `{"key":…,"action":"find","q":"Allenspach","since":"2026-07-01"}` → liste (uid, date, from, to, subject, taille)
- `{"key":…,"action":"import","account":"info@teamlausanne.ch","uids":[32880]}` → insère (imap_uid = `all:<uid>`, statut à traiter)

Déployée le 07.09.2026 (v1) pour retrouver le mail Allenspach du 11 août, absent car l'import « 6 mois »
(mail-history) n'avait jamais abouti et la relève n'a démarré que le 28 août. Le code source est dans le
dashboard Supabase (Edge Functions › mail-find).
