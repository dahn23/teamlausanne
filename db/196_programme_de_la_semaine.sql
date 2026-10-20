-- 196 — Le planning tournois porte enfin le PROGRAMME de la semaine.
--
-- Demande du 20.10.2026, avec deux fichiers en main : « Planificacion Anual »
-- (la planification hebdomadaire du groupe sport-études, faite par le
-- préparateur) et le calendrier PDF de la saison.
--
-- CE QUI MANQUAIT. Le tableur tient six colonnes par semaine : Semaine, Date,
-- Tennis, Préparation physique, Compétition / week-end, Notes. Notre planning
-- n'en gardait que deux — le type de semaine (prépa / entraînement / option /
-- vacances / étranger) et les zones de tournoi du week-end. Tout le contenu,
-- c'est-à-dire ce qu'on travaille réellement, restait dans le tableur, donc
-- invisible du jeune.
--
-- Deux colonnes de texte suffisent : tennis et physique. La colonne note
-- existait déjà et ne servait pas ; elle accueille la colonne Notes du
-- fichier (« deux tournois recommandés sur la période du 05.10 au 25.10 »).
--
-- Pourquoi pas une table « contenu de semaine » : il y a exactement une ligne
-- de tennis et une de physique par semaine et par joueur, soit les mêmes clés
-- que plan_weeks. Une table de plus n'aurait ajouté qu'une jointure.
--
-- La planification de Célyan Lorival a été reprise du fichier, semaine par
-- semaine, du 21.09.2026 au 12.04.2027 : 27 semaines de contenu, les types
-- alignés sur la colonne Tennis (vacances quand le fichier le dit), et les
-- zones de week-end nommées « Tournoi » ou « Tournoi possible » au lieu du
-- « Zone tournoi » générique.

begin;

alter table plan_weeks add column if not exists tennis text;
alter table plan_weeks add column if not exists physique text;

comment on column plan_weeks.tennis is
  'Ce qui est travaillé sur le court cette semaine-là (colonne « Tennis » de la planification).';
comment on column plan_weeks.physique is
  'Le programme de préparation physique de la semaine.';
comment on column plan_weeks.note is
  'Remarque libre sur la semaine (ex. « deux tournois recommandés sur la période »).';

commit;
