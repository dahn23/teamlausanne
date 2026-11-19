-- 247 — Calendrier : un élément qui se répète (19.11.2026)
--
-- Besoin : « tous les 20 du mois, vérifier que la facturation est bien
-- partie ». Aujourd'hui il faut reposer la ligne à la main, douze fois.
--
-- ⚠ POURQUOI ON FABRIQUE LES OCCURRENCES PLUTÔT QUE DE GARDER UNE RÈGLE
-- Deux écoles : stocker la règle et la dérouler à la lecture, ou écrire une
-- ligne par occurrence. On écrit les lignes, et c'est un choix de prudence :
-- `cal_events` est lu de PARTOUT — la grille du mois, la vue année, la liste,
-- `agenda_public()` pour le site, `agenda_famille()` pour Mon espace, le
-- décompte des congés (db/109), le lien du suivi (db/155), les pastilles de
-- visibilité, les policies. Une règle déroulée à la lecture obligerait à
-- apprendre la récurrence à CHACUN de ces endroits, et le premier oublié
-- afficherait un calendrier faux sans rien dire. Une occurrence écrite est une
-- ligne ordinaire : tout ce qui existe continue de marcher sans le savoir.
-- Le prix à payer : la série est un GROUPE de lignes, d'où `series_id`.
--
-- ⚠ Pas de récurrence sur `vacances` ni `absence` — côté console, le formulaire
-- ne la propose pas. Ces deux genres alimentent le solde de congés (db/109) :
-- répéter des vacances viderait un solde sans que personne l'ait demandé.
alter table public.cal_events add column if not exists series_id   uuid;
alter table public.cal_events add column if not exists series_rule text;

comment on column public.cal_events.series_id is
  'Même valeur sur toutes les occurrences d''une série ; null = élément isolé.';
comment on column public.cal_events.series_rule is
  'La règle qui a produit la série, en clair (« Chaque mois, le 20 »), recopiée sur chaque occurrence pour qu''une ligne seule puisse se présenter.';

-- Une série se lit et se supprime d'un bloc : l'index sert aux deux.
create index if not exists cal_events_series_idx
  on public.cal_events (series_id) where series_id is not null;
