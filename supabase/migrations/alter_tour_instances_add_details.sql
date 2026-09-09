ALTER TABLE tour_instances
  ADD COLUMN IF NOT EXISTS departure_time         time,
  ADD COLUMN IF NOT EXISTS departure_address      text,
  ADD COLUMN IF NOT EXISTS agency_departure_notes text,
  ADD COLUMN IF NOT EXISTS meeting_point          text,
  ADD COLUMN IF NOT EXISTS tour_stops             jsonb,
  ADD COLUMN IF NOT EXISTS materials_needed       text;
