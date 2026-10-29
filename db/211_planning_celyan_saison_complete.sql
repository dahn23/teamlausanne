-- 211 — La saison de Célyan Lorival, finalisée d'après le planning sport-études.
--
-- Le fichier « Planning sport etudes julliet 2027 » est désormais complet :
-- 41 semaines, du lundi 21.09.2026 au vendredi 02.07.2027. La version que nous
-- avions en main pour db/196 s'arrêtait au 12.04.2027 ; la console reflétait
-- cet arrêt — passé cette date, la frise de Célyan était vide.
--
-- CE QUE LE FICHIER TRANCHE, et que nous reprenons tel quel :
--   • le type de chaque semaine (prépa / entraînement / vacances) ;
--   • la colonne Tennis ;
--   • les week-ends de compétition ;
--   • les notes de période.
--
-- CE QUE NOUS GARDONS. La colonne « Préparation physique » du fichier est plus
-- générique que ce que la console affiche déjà (« Bloc physique » contre
-- « Cardio, circuits neuromusculaires, force et lancers »). Ce détail vient du
-- préparateur ; l'écraser par un libellé de synthèse ferait reculer ce que lit
-- le jeune dans Mon espace. Il reste donc en place, et le fichier ne remplit
-- que les semaines qui n'avaient rien — c'est-à-dire les douze nouvelles.
--
-- DEUX SEMAINES CHANGENT DE NATURE, et là le fichier a forcément raison :
--   • 04.01.2027 : « Reprise du tennis », et non plus des vacances de Noël.
--     Son physique disait « Repos » — un reliquat de la semaine de vacances,
--     pas un choix du préparateur : il devient « Adaptation physique ».
--   • 08.02.2027 : bloc physique intensif, et non plus des vacances. Le détail
--     du préparateur colle déjà ; la consigne du fichier (charges diminuées
--     jeudi et vendredi) n'avait nulle part où vivre, elle passe en note.
--
-- Les semaines du 21.09.2026 et du 05.04.2027 sont vides dans le fichier :
-- on n'y touche pas.

begin;

-- ---- Le contenu des 39 semaines décrites par le fichier ----
insert into plan_weeks (person_id, week_start, kind, tennis, physique, note)
values
  ('333cb7e9-d090-4052-a741-041abcaec015', '2026-09-28', 'entrainement', 'Travail tactique et schémas de jeu', 'Prépa tournois : réactivité et technique', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2026-10-05', 'vacances', 'Vacances', 'Programme tournois : force, santé, symétrie', 'Deux tournois recommandés au total sur la période du 05.10 au 25.10'),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2026-10-12', 'vacances', 'Vacances', 'Programme tournois : force, santé, symétrie', 'Deux tournois recommandés au total sur la période du 05.10 au 25.10'),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2026-10-19', 'vacances', 'Vacances', 'Programme tournois : force, santé, symétrie', 'Deux tournois recommandés au total sur la période du 05.10 au 25.10'),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2026-10-26', 'entrainement', 'Ajustements techniques', 'Post-tournoi : zone médiane et technique', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2026-11-02', 'prepa', 'Faible volume, travail spécifique', 'Cardio, circuits neuromusculaires, force et lancers', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2026-11-09', 'prepa', 'Faible volume, travail spécifique', 'Coordination, pliométrie, zone médiane', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2026-11-16', 'prepa', 'Mise au point tennis', 'Prépa tournoi : réactivité et explosivité', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2026-11-23', 'entrainement', 'Compétition', 'Programme tournois : force, santé, symétrie', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2026-11-30', 'entrainement', 'Compétition', 'Programme tournois : force, santé, symétrie', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2026-12-07', 'entrainement', 'Compétition', 'Programme tournois : force, santé, symétrie', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2026-12-14', 'entrainement', 'Compétition', 'Programme tournois : force, santé, symétrie', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2026-12-21', 'vacances', 'Vacances de Noël', 'Repos', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2026-12-28', 'vacances', 'Vacances de Noël', 'Repos', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-01-04', 'entrainement', 'Reprise du tennis', 'Adaptation physique', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-01-11', 'prepa', 'Mise au point tennis', 'Pré-tournoi : réactivité et explosivité', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-01-18', 'entrainement', 'Travail tactique', 'Programme tournois : force, santé, symétrie', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-01-25', 'entrainement', 'Travail tactique', 'Programme tournois : force, santé, symétrie', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-02-01', 'prepa', 'Travail technique spécifique', 'Bloc intense : force explosive et circuits', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-02-08', 'prepa', null, 'Bloc intense : force explosive et circuits', 'Diminution des charges jeudi et vendredi'),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-02-15', 'entrainement', 'Schémas de jeu et matchs', 'Programme tournois : force, santé, symétrie', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-02-22', 'entrainement', 'Schémas de jeu et matchs', 'Programme tournois : force, santé, symétrie', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-03-01', 'entrainement', 'Schémas de jeu et matchs', 'Programme tournois : force, santé, symétrie', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-03-08', 'prepa', null, 'Force, réaction, appuis et technique', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-03-15', 'prepa', null, 'Résistance : circuits neuromusculaires', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-03-22', 'entrainement', 'Schémas avec service et points', 'Programme tournois : force, santé, symétrie', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-03-29', 'entrainement', 'Schémas de jeu et matchs', 'Programme tournois : force, santé, symétrie', null),
  -- À partir d'ici, tout est nouveau : la saison extérieure sur terre battue.
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-04-12', 'entrainement', 'Adaptation à la terre battue extérieure : rythme, rebond, hauteur de balle et premières glissades', 'Adaptation à la surface : appuis, glissades, mobilité et freinage', 'Transition vers la saison extérieure'),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-04-19', 'entrainement', 'Adaptation terre battue : déplacements, glissades et construction du point', 'Appuis spécifiques, changements de direction et renforcement préventif', 'Augmentation progressive du volume'),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-04-26', 'entrainement', 'Schémas de jeu sur terre battue, service +1 et retour', 'Entretien et récupération', 'Début du bloc de compétition'),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-05-03', 'entrainement', 'Construction du point, profondeur et changements de direction', 'Entretien et récupération', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-05-10', 'entrainement', 'Schémas de jeu, points et matchs', 'Entretien et récupération', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-05-17', 'prepa', 'Travail technique spécifique et régularité', 'Développement de la force et stabilité', 'Bloc de travail'),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-05-24', 'prepa', 'Construction du point et transition défense-attaque', 'Puissance, vitesse et déplacements spécifiques', 'Bloc de travail'),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-05-31', 'entrainement', 'Schémas de jeu et matchs', 'Entretien et récupération', 'Début de la période des interclubs'),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-06-07', 'entrainement', 'Schémas avec service, retour et points', 'Entretien et récupération', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-06-14', 'entrainement', 'Matchs et gestion des situations de compétition', 'Entretien et récupération', null),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-06-21', 'prepa', 'Ajustements techniques et travail spécifique', 'Développement de la force et prévention', 'Bloc de travail'),
  ('333cb7e9-d090-4052-a741-041abcaec015', '2027-06-28', 'entrainement', 'Consolidation, points et bilan de fin de période', 'Puissance, vitesse et tests de fin de période', 'Planification jusqu''au vendredi 02.07')
on conflict (person_id, week_start) do update
  set kind = excluded.kind,
      tennis = excluded.tennis,
      physique = excluded.physique,
      note = excluded.note,
      updated_at = now();

-- ---- Les six week-ends de compétition qui manquaient ----
-- Les neuf autres (septembre à mars) sont déjà posés et correspondent au fichier.
insert into plan_tournaments (person_id, week_start, name, source)
select '333cb7e9-d090-4052-a741-041abcaec015', v.ws::date, v.nom, 'staff'
from (values
  ('2027-04-26', 'Tournoi'),
  ('2027-05-03', 'Tournoi'),
  ('2027-05-10', 'Tournoi'),
  ('2027-05-31', 'Tournoi / interclubs'),
  ('2027-06-07', 'Tournoi / interclubs'),
  ('2027-06-14', 'Tournoi / interclubs')
) as v(ws, nom)
where not exists (
  select 1 from plan_tournaments t
  where t.person_id = '333cb7e9-d090-4052-a741-041abcaec015'
    and t.source = 'staff' and t.week_start = v.ws::date);

commit;
