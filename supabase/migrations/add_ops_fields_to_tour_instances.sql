-- Campos operacionales: vehículo, honorario guía, proveedor externo
ALTER TABLE tour_instances
  ADD COLUMN IF NOT EXISTS van_id         uuid REFERENCES vans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guide_fee      int,
  ADD COLUMN IF NOT EXISTS provider_id    uuid REFERENCES service_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_fee   int,
  ADD COLUMN IF NOT EXISTS provider_scope text;
