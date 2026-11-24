-- 248 — Calendrier : un type « Appel » (24.11.2026)
--
-- Les appels se calaient jusqu'ici en « Événement », comme les réunions et les
-- rendez-vous. Quand on en pose plusieurs par semaine, la liste du mois ne
-- distingue plus un appel de midi d'un camp ou d'une porte ouverte : tout est
-- bleu « Événement ». Un genre à part leur donne leur couleur et leur filtre.
--
-- ⚠ « kind » est un texte sous contrainte, pas un enum : sans cette migration,
-- chaque enregistrement serait refusé par cal_kind_connu — et le formulaire
-- n'aurait aucun moyen de le dire autrement qu'en échouant.
--
-- ⚠ « appel » est INTERNE par construction, et rien ici n'a besoin de le dire :
-- agenda_public et agenda_famille listent nommément les genres qu'elles
-- publient ('fermeture', 'camp', 'evenement'). Un genre inconnu d'elles ne
-- sort donc jamais — c'est une liste d'autorisation, pas une liste d'exclusion,
-- et c'est ce qui rend l'ajout sûr.
--
-- ⚠ Le solde de congés (db/109, db/110) ne compte que 'vacances' : un appel ne
-- l'effleure pas. Les policies ne traitent à part que 'vacances' : un appel se
-- crée et se modifie comme un événement ordinaire.

alter table public.cal_events drop constraint if exists cal_kind_connu;

alter table public.cal_events add constraint cal_kind_connu
  check (kind = any (array[
    'vacances'::text, 'fermeture'::text, 'camp'::text, 'evenement'::text,
    'test'::text, 'absence'::text, 'essai'::text, 'appel'::text
  ]));
