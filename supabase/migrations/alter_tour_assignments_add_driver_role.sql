-- Separar rol de guía y conductor en tour_assignments
-- (antes: unique por tour_instance_id solo → ahora: unique por tour_instance_id + role_in_tour)

-- 1. Quitar constraint única anterior sobre tour_instance_id
ALTER TABLE tour_assignments DROP CONSTRAINT IF EXISTS tour_assignments_tour_instance_id_key;

-- 2. Migrar 'guide_driver' existentes a 'guide' antes de cambiar el check
UPDATE tour_assignments SET role_in_tour = 'guide' WHERE role_in_tour = 'guide_driver';

-- 3. Actualizar check constraint de roles
ALTER TABLE tour_assignments DROP CONSTRAINT IF EXISTS tour_assignments_role_in_tour_check;
ALTER TABLE tour_assignments ADD CONSTRAINT tour_assignments_role_in_tour_check
  CHECK (role_in_tour IN ('guide', 'driver'));

-- 4. Nueva unique: una persona por rol por instancia
ALTER TABLE tour_assignments
  ADD CONSTRAINT tour_assignments_instance_role_unique
  UNIQUE (tour_instance_id, role_in_tour);
