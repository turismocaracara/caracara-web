-- Elimina columnas de proveedor único (recién añadidas, sin datos de producción).
-- El fee del guía se mueve a tour_assignments.fee.
-- Los proveedores externos se mueven a tour_instance_providers.
ALTER TABLE tour_instances
  DROP COLUMN IF EXISTS op_agency_id,
  DROP COLUMN IF EXISTS op_provider_id,
  DROP COLUMN IF EXISTS provider_fee,
  DROP COLUMN IF EXISTS provider_scope,
  DROP COLUMN IF EXISTS guide_fee;

-- Van externa: descripción libre cuando no se usa una van registrada
ALTER TABLE tour_instances
  ADD COLUMN IF NOT EXISTS external_van_notes text;
