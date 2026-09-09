-- 52_lockers_femmes.sql
-- Casiers femmes : n° 1 à 100. Complète 46_lockers.sql, qui laissait « Femmes : liste à venir ».
-- Rien à changer côté front : l'onglet Femmes et les colonnes (n°, nom, e-mail, date, payé,
-- note) sont partagés avec les hommes — même table, seul le filtre gender change.
insert into public.lockers (gender, number)
select 'F', n from generate_series(1, 100) n
on conflict (gender, number) do nothing;
