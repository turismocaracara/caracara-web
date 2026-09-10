-- Baja lógica de miembros del equipo
-- terminated_at: NULL = activo, NOT NULL = dado de baja en esa fecha

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS terminated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS termination_reason text;

-- Cambiar CASCADE → RESTRICT en documentos y pagos
-- para que un delete accidental no borre el historial

ALTER TABLE member_documents
  DROP CONSTRAINT IF EXISTS member_documents_member_id_fkey;
ALTER TABLE member_documents
  ADD CONSTRAINT member_documents_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES team_members(id) ON DELETE RESTRICT;

ALTER TABLE member_payment_items
  DROP CONSTRAINT IF EXISTS member_payment_items_member_id_fkey;
ALTER TABLE member_payment_items
  ADD CONSTRAINT member_payment_items_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES team_members(id) ON DELETE RESTRICT;
