-- =====================================================================
--  ACADÉMIE DE TENNIS — Seed des courts
--  Été (mi-avril→mi-octobre) : 10 outdoor + 2 indoor = 12 jouables.
--  Hiver (mi-octobre→mi-avril) : 2 indoor fixes + 4 outdoor sous bulle = 6.
--  → Courts 1 à 4 = outdoor couverts par la bulle l'hiver (open_winter=true).
--    Courts 5 à 10 = outdoor plein air uniquement (open_winter=false).
--    Indoor A/B = indoor fixes, ouverts toute l'année.
--  (Surfaces indicatives, à ajuster avec Dan si besoin.)
-- =====================================================================

insert into courts (id, name, surface, location, open_summer, open_winter, display_order, is_active) values
  ( 1, 'Court 1',  'terre battue', 'outdoor', true, true,  1,  true),
  ( 2, 'Court 2',  'terre battue', 'outdoor', true, true,  2,  true),
  ( 3, 'Court 3',  'terre battue', 'outdoor', true, true,  3,  true),
  ( 4, 'Court 4',  'terre battue', 'outdoor', true, true,  4,  true),
  ( 5, 'Court 5',  'terre battue', 'outdoor', true, false, 5,  true),
  ( 6, 'Court 6',  'terre battue', 'outdoor', true, false, 6,  true),
  ( 7, 'Court 7',  'terre battue', 'outdoor', true, false, 7,  true),
  ( 8, 'Court 8',  'terre battue', 'outdoor', true, false, 8,  true),
  ( 9, 'Court 9',  'terre battue', 'outdoor', true, false, 9,  true),
  (10, 'Court 10', 'terre battue', 'outdoor', true, false, 10, true),
  (11, 'Indoor A', 'dur',          'indoor',  true, true,  11, true),
  (12, 'Indoor B', 'dur',          'indoor',  true, true,  12, true)
on conflict (id) do update set
  name          = excluded.name,
  surface       = excluded.surface,
  location      = excluded.location,
  open_summer   = excluded.open_summer,
  open_winter   = excluded.open_winter,
  display_order = excluded.display_order,
  is_active     = excluded.is_active;
