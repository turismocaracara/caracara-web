-- fee y notas por asignación de guía (antes era global en tour_instances)
ALTER TABLE tour_assignments
  ADD COLUMN IF NOT EXISTS fee   int,
  ADD COLUMN IF NOT EXISTS notes text;

-- Permitir múltiples team_members por instancia.
-- El constraint anterior era UNIQUE(tour_instance_id) → solo un guía.
ALTER TABLE tour_assignments
  DROP CONSTRAINT IF EXISTS tour_assignments_tour_instance_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS tour_assignments_instance_member_unique
  ON tour_assignments (tour_instance_id, team_member_id);
