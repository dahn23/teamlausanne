-- 145 — Une note du secrétariat sur chaque inscrit de stage.
--
-- Raphael, 09.10.2026 : « un petit cadre de texte, pour écrire des notes pour
-- chaque enfant au besoin ».
--
-- Colonne SÉPARÉE de « comment », et non réutilisation de celle-ci. « comment »
-- vient du formulaire public : c'est ce que la famille a écrit. Le secrétariat
-- qui prend une note ne doit pas pouvoir effacer la phrase d'un parent, ni la
-- voir confondue avec la sienne. Les deux s'affichent côte à côte dans la fiche
-- du stage, la famille en citation, le secrétariat dans un champ modifiable.

alter table public.stage_registrations
  add column if not exists staff_note text;

comment on column public.stage_registrations.staff_note is
  'Note interne du secrétariat sur un inscrit (allergie, parent à rappeler, arrive en retard…). Distincte de « comment », qui appartient à la famille et vient du formulaire public : on ne réécrit pas ce qu''elle a dit.';
