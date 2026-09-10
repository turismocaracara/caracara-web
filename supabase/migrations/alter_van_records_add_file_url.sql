ALTER TABLE van_documents   ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE van_odometer    ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE van_maintenance ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE van_fuel        ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE van_tag_costs   ADD COLUMN IF NOT EXISTS file_url text;
