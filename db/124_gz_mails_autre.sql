-- 30.09.2026 (décision Dan) : modèles « autre » pour les tournois NON cochés GameZone (ex. « Tournoi de l'automne »).
-- Non-sélection, annulation et remerciement : même texte que la version GameZone, SANS le lien vers les prochains
-- tournois GameZone ({lien_tournois}) ; le sondage est gardé. gz-notify choisit « <clé>_autre » quand is_gamezone = false
-- (les envois restent notés sous la clé de base dans gz_mail_sent, les compteurs de la console ne changent pas).
insert into public.gz_email_templates(key, name, subject, body, image_url, trigger_desc, enabled, sort_order) values
('non_selection_autre', 'Non-sélection (liste d''attente) — autre',
 'Ton inscription au tournoi {tournoi}',
 E'Bonjour {prenom},\n\nMerci pour ton inscription au tournoi {tournoi}. Malheureusement, tu es actuellement sur liste d''attente ; nous te recontacterons si une place se libère.\n\nLa sélection se fait selon l''ordre d''inscription — pense à t''inscrire plus tôt pour les prochains !\n\nÀ bientôt,\nTeam Lausanne',
 null, 'Aux joueurs en liste d''attente — tournois NON GameZone (sans lien vers les tournois GameZone).', true, 7),
('annulation_autre', 'Annulation du tournoi — autre',
 'Annulation du tournoi {tournoi}',
 E'Bonjour {prenom},\n\nMerci pour ton inscription au tournoi {tournoi}. Malheureusement, il a dû être annulé faute d''un nombre suffisant d''inscriptions.\n\nÀ bientôt,\nTeam Lausanne',
 null, 'Aux inscrits si le tournoi est annulé — tournois NON GameZone (sans lien vers les tournois GameZone).', true, 8),
('remerciement_autre', 'Remerciement — autre',
 'Merci pour ta participation !',
 E'Bonjour {prenom},\n\nMerci d''avoir participé au tournoi {tournoi} ce week-end ! Nous espérons que tu as pris du plaisir.\n\n🙏 Aide-nous à nous améliorer avec ce court sondage : {lien_sondage}\n\nÀ bientôt,\nTeam Lausanne',
 null, 'Le lundi 11h après le tournoi, aux présents — tournois NON GameZone (sans lien vers les tournois GameZone).', true, 9)
on conflict (key) do nothing;

-- Les modèles GameZone disent maintenant pour quels tournois ils partent.
update public.gz_email_templates set name = 'Non-sélection (liste d''attente) — GameZone',
  trigger_desc = 'Aux joueurs en liste d''attente — tournois GameZone.' where key = 'non_selection';
update public.gz_email_templates set name = 'Annulation du tournoi — GameZone',
  trigger_desc = 'Aux inscrits si le tournoi est annulé — tournois GameZone.' where key = 'annulation';
update public.gz_email_templates set name = 'Remerciement — GameZone' where key = 'remerciement';
