-- 83 — Classement Swiss Tennis stocké sur la fiche (21.09.2026).
--   people.classification (N1–N4, R1–R9) + classification_at.
--   Sources : (a) la recherche publique Swiss Tennis (player-autocomplete-query : renvoie le classement SANS
--   connexion, rapproché par n° de licence) — premier remplissage des 78 licenciés le 21.09.2026 ;
--   (b) l'import des matchs mytennis (mt-import v9), qui reçoit déjà ce classement du favori et le jetait.
--   Le RANG national (« N4 (148) ») et la valeur de classement ne sont pas publics : ils ne viennent que du
--   relevé juniors (table prospects) ou d'une session mytennis connectée.
alter table public.people
  add column if not exists classification text,
  add column if not exists classification_at timestamptz;
-- La fonction mental_participants_stats prend le classement le plus récent entre la fiche et le relevé juniors,
-- puis, à défaut, celui vu comme adversaire dans un match importé (voir la définition en base).
