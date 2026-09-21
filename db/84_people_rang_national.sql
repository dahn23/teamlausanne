-- 84 — Rang national et valeur de classement sur la fiche (21.09.2026).
--   people.ranking_position (« N4 (148) » -> 148) et people.ranking_value (10.601).
--   Non publics : lus par le favori « Importer les matchs » en session mytennis connectée
--   (lizenz_nehmer{classification ranking classificationValue}), pour TOUT le répertoire licencié —
--   adultes compris, sans passer par le relevé de toute la Suisse. Enregistrés par mt-import v10.
alter table public.people
  add column if not exists ranking_position integer,
  add column if not exists ranking_value numeric;
-- mental_participants_stats : le rang affiché = celui de la fiche s'il est au moins aussi récent que le relevé
-- juniors (prospects), sinon celui du relevé ; voir la définition en base.
