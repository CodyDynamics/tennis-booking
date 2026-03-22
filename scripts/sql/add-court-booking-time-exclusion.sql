-- Run manually when DB_SYNC=false or after first deploy.
-- Requires: bookingStartAt / bookingEndAt populated on insert (see CourtBookingHandler).
-- Ensures no two active bookings overlap on the same court (Postgres = source of truth).

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Partial exclusion: only pending + confirmed rows participate; cancelled/completed can overlap historically.
ALTER TABLE court_bookings
  DROP CONSTRAINT IF EXISTS court_bookings_no_overlap;

ALTER TABLE court_bookings
  ADD CONSTRAINT court_bookings_no_overlap
  EXCLUDE USING gist (
    "courtId" WITH =,
    tstzrange("bookingStartAt", "bookingEndAt", '[)') WITH &&
  )
  WHERE ("bookingStatus" IN ('pending', 'confirmed'));

-- Note: tstzrange(..., '[)') = half-open [start, end) — align app logic with interval semantics.
