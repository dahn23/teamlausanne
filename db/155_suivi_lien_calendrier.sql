-- Le suivi écrit dans le calendrier (14.10.2026).
--
-- Un bloc qui se contente de dire « tu es en retard » ne fait rien avancer :
-- on le regarde, on acquiesce, on passe. Pour que ça bouge, il faut pouvoir
-- PLANIFIER depuis le bloc — et que le rendez-vous apparaisse là où on regarde
-- son agenda, c'est-à-dire dans le calendrier du club.
--
-- Chaque ligne de suivi prévue porte donc l'événement de calendrier qu'elle a
-- créé. Annuler le rendez-vous retire aussi la case du calendrier ; supprimer
-- l'événement côté calendrier laisse la ligne de suivi en place (on perd le
-- lien, pas la trace), d'où `on delete set null` plutôt qu'une cascade.
alter table public.suivi_contacts add column if not exists cal_event_id uuid
  references public.cal_events(id) on delete set null;
create index if not exists suivi_contacts_cal_idx on public.suivi_contacts(cal_event_id);
