-- =====================================================================
--  ACADÉMIE DE TENNIS — Seed des courts (config validée par Dan)
--  1-2-3-12 : terre battue, extérieur, ÉTÉ seulement (pas de bulle).
--  4-5-6-7  : terre battue, bulle chauffée l'HIVER → été + hiver.
--  8-9      : gazon synthétique, extérieur, ÉTÉ seulement.
--  10-11    : dur, halle intérieure, été comme hiver.
--  → Été : 12 courts. Hiver : 4-5-6-7 (bulle) + 10-11 (halle) = 6.
-- =====================================================================
insert into courts (id, name, surface, location, open_summer, open_winter, display_order, is_active) values
  ( 1, 'Court 1',  'terre battue',      'outdoor', true, false, 1,  true),
  ( 2, 'Court 2',  'terre battue',      'outdoor', true, false, 2,  true),
  ( 3, 'Court 3',  'terre battue',      'outdoor', true, false, 3,  true),
  ( 4, 'Court 4',  'terre battue',      'outdoor', true, true,  4,  true),
  ( 5, 'Court 5',  'terre battue',      'outdoor', true, true,  5,  true),
  ( 6, 'Court 6',  'terre battue',      'outdoor', true, true,  6,  true),
  ( 7, 'Court 7',  'terre battue',      'outdoor', true, true,  7,  true),
  ( 8, 'Court 8',  'gazon synthétique', 'outdoor', true, false, 8,  true),
  ( 9, 'Court 9',  'gazon synthétique', 'outdoor', true, false, 9,  true),
  (10, 'Court 10', 'dur',               'indoor',  true, true,  10, true),
  (11, 'Court 11', 'dur',               'indoor',  true, true,  11, true),
  (12, 'Court 12', 'terre battue',      'outdoor', true, false, 12, true)
on conflict (id) do update set
  name=excluded.name, surface=excluded.surface, location=excluded.location,
  open_summer=excluded.open_summer, open_winter=excluded.open_winter,
  display_order=excluded.display_order, is_active=excluded.is_active;
