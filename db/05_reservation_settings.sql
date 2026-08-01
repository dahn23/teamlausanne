-- =====================================================================
--  RÉSERVATION — Réglages paramétrables + accès public en lecture
--  Table app_settings (clé → valeur JSON), éditée depuis la console admin.
--  Lecture publique (anon) des courts, réservations et réglages : la grille
--  de dispo est visible sans login (des externes peuvent aussi réserver).
-- =====================================================================
create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;

drop policy if exists settings_read on app_settings;
drop policy if exists settings_write on app_settings;
create policy settings_read on app_settings for select to anon, authenticated using (true);
create policy settings_write on app_settings for all to authenticated
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- Accès public en lecture (dispo visible sans login)
drop policy if exists courts_read on courts;
create policy courts_read on courts for select to anon, authenticated using (true);
drop policy if exists cb_read on court_bookings;
create policy cb_read on court_bookings for select to anon, authenticated using (true);

-- Valeurs par défaut
insert into app_settings (key, value) values
  ('season', '{"winter_start":"2026-10-19","winter_end":"2027-04-11"}'),
  ('hours', '{"first":"08:15","last":"21:15"}'),
  ('quotas', '{"max_hours_member":2,"max_hours_nonmember":2,"invitations_per_season_member":2,"advance_days_member":7,"advance_days_nonmember":3}'),
  ('visibility', '{"show_names_to_member":true,"show_names_to_client":false}'),
  ('pricing', '{
     "hiver":     {"creuse":{"m_m":34,"second":29,"m_guest":37,"ext":40},"pleine":{"m_m":39,"second":34,"m_guest":42,"ext":45}},
     "ete_ext":   {"creuse":{"m_m":0,"second":0,"m_guest":15,"ext":25},"pleine":{"m_m":0,"second":0,"m_guest":20,"ext":35}},
     "ete_halle": {"creuse":{"m_m":34,"second":29,"m_guest":37,"ext":40},"pleine":{"m_m":39,"second":34,"m_guest":42,"ext":45}}
   }'),
  ('peak', '{"1":[12,13,17,18,19,20,21],"2":[12,13,17,18,19,20,21],"3":[12,13,14,15,16,17,18,19,20,21],"4":[12,13,17,18,19,20,21],"5":[12,13,17,18,19,20,21],"6":[10,11,12,13,14,15,16,17,18,19,20,21],"7":[10,11,12,13,14,15,16,17,18,19,20,21]}'),
  ('confirmation_email', '{"subject":"Confirmation de votre réservation — Team Lausanne","body":"Bonjour,\n\nVotre réservation est confirmée.\n\nÀ bientôt sur les courts,\nTeam Lausanne"}')
on conflict (key) do nothing;
