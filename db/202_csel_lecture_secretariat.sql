-- 202 — CSEL : le secrétariat lit le planning des repas (22.10.2026).
-- Onglet CSEL ouvert nominativement à Séline Rivaroli et Arsalan Huber (app_settings.tab_allow, « csel »).
-- Sans cette lecture, ils voyaient les repas du contrat SANS les changements de la semaine : de faux totaux.
-- L'écriture reste admin seul (policy csel_mo_all, inchangée) ; la console leur masque clics et « Réinitialiser ».
create policy csel_mo_read on public.csel_meal_overrides for select using (can_interne(auth.uid()));

-- Donnée (appliquée à la main, pas une migration) :
-- update app_settings set value = value
--   || '{"21c6acc5-abc9-4b5a-945f-7b03ac96dec7": ["csel"], "4918a96e-27a9-4923-8975-42b76e9a7e5d": ["csel"]}'::jsonb
--  where key = 'tab_allow';
