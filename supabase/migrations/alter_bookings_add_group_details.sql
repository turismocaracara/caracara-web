ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS equipment_notes      text,
  ADD COLUMN IF NOT EXISTS dietary_restrictions text,
  ADD COLUMN IF NOT EXISTS physical_level       text,
  ADD COLUMN IF NOT EXISTS accessibility_notes  text,
  ADD COLUMN IF NOT EXISTS special_requests     text;
