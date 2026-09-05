-- Campos operacionales en tour_instances
-- op_agency_id    → la operación la realiza una agencia ya registrada en agencies
-- op_provider_id  → la operación la realiza un proveedor nuevo (service_providers)
-- Solo uno de los dos estará relleno cuando el tour sea externalizado.

ALTER TABLE tour_instances
  ADD COLUMN IF NOT EXISTS van_id         uuid REFERENCES vans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guide_fee      int,
  ADD COLUMN IF NOT EXISTS op_agency_id   uuid REFERENCES agencies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS op_provider_id uuid REFERENCES service_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_fee   int,
  ADD COLUMN IF NOT EXISTS provider_scope text;
