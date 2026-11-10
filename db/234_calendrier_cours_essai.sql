-- 234 — Calendrier : un type « Cours d'essai »
--
-- Les cours d'essai sont nombreux et se posaient jusqu'ici en « Événement »,
-- donc noyés parmi les réunions et les rendez-vous. Un type à eux les rend
-- filtrables dans la vue année et leur donne leur couleur.
--
-- Rien d'autre à toucher : agenda_public() et agenda_famille() nomment les
-- genres qu'elles publient ('fermeture', 'camp', 'evenement'), donc un cours
-- d'essai reste interne à la console sans qu'on ait à l'écrire. De même, les
-- policies ne distinguent que 'vacances' : un essai s'ajoute et se modifie
-- comme une fermeture ou un camp.

alter table cal_events drop constraint cal_kind_connu;
alter table cal_events add constraint cal_kind_connu
  check (kind in ('vacances','fermeture','camp','evenement','test','absence','essai'));
