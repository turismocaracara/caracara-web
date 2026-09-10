ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS phone           text,
  ADD COLUMN IF NOT EXISTS emergency_name  text,
  ADD COLUMN IF NOT EXISTS emergency_phone text,
  ADD COLUMN IF NOT EXISTS rut             text,
  ADD COLUMN IF NOT EXISTS birthdate       date,
  ADD COLUMN IF NOT EXISTS notes           text;

CREATE TABLE IF NOT EXISTS member_documents (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  uuid        NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  type       text        NOT NULL CHECK (type IN ('contrato','cedula','licencia','primeros_auxilios','otro')),
  expires_at date,
  notes      text,
  file_url   text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (member_id, type)
);

CREATE INDEX IF NOT EXISTS idx_member_documents_member ON member_documents (member_id);
