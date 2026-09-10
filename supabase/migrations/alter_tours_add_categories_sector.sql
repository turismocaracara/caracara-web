ALTER TABLE tours
  ADD COLUMN IF NOT EXISTS categories text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sector     text[] DEFAULT '{}';
