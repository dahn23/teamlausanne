-- =====================================================================
--  ACADÉMIE DE TENNIS — Anti double-réservation
--  Empêche deux réservations qui se chevauchent sur le même court.
--  (tsrange = plage date+heure ; && = chevauchement)
-- =====================================================================
create extension if not exists btree_gist;

alter table court_bookings
  add constraint court_bookings_no_overlap
  exclude using gist (
    court_id with =,
    tsrange(booking_date + start_time, booking_date + end_time) with &&
  );
