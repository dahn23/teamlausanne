-- Calendrier d'équipe : un type « Absence ».
--
-- Jusqu'ici, la seule façon de dire qu'un membre n'était pas là était
-- « Vacances ». Or une absence n'est pas un congé : maladie, accident, service
-- militaire, formation, raison personnelle. Les mélanger fausse deux choses —
-- le solde de vacances de la personne, et la lecture du calendrier, où l'on ne
-- distingue plus ce qui était prévu de ce qui ne l'était pas.
--
-- Différence de nature, donc différence de traitement :
--   · des vacances se DEMANDENT   → la ligne naît en 'demande', un responsable
--     tranche (cal_decider) ;
--   · une absence se CONSTATE     → la ligne naît en 'valide', comme une
--     fermeture ou un camp. On ne demande pas la permission d'être malade.
--
-- cal_decider reste volontairement réservé aux vacances : il n'y a rien à
-- valider sur une absence. Et cal_ligne_a_moi laisse déjà son auteur corriger
-- une ligne 'valide' tant que ce ne sont pas des vacances accordées — une
-- absence reste donc rectifiable par celui qui l'a saisie.

alter table public.cal_events drop constraint if exists cal_kind_connu;
alter table public.cal_events add constraint cal_kind_connu
  check (kind in ('vacances','fermeture','camp','evenement','test','absence'));

-- Une absence, comme des vacances, est celle de QUELQU'UN : sans membre, la
-- ligne ne dit rien. On renomme la contrainte, qui ne parle plus des seules
-- vacances.
alter table public.cal_events drop constraint if exists cal_vacances_ont_un_membre;
alter table public.cal_events drop constraint if exists cal_absence_a_un_membre;
alter table public.cal_events add constraint cal_absence_a_un_membre
  check (kind not in ('vacances','absence') or member_id is not null);
