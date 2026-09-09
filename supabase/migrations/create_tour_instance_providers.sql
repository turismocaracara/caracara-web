-- Proveedores externos por instancia de tour.
-- Reemplaza op_agency_id / op_provider_id (columnas únicas) por una tabla
-- que admite múltiples proveedores por instancia.
CREATE TABLE IF NOT EXISTS tour_instance_providers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_instance_id    uuid        NOT NULL REFERENCES tour_instances(id) ON DELETE CASCADE,
  agency_id           uuid        REFERENCES agencies(id) ON DELETE SET NULL,
  service_provider_id uuid        REFERENCES service_providers(id) ON DELETE SET NULL,
  role                text,
  fee                 int,
  scope               text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tip_instance_idx ON tour_instance_providers (tour_instance_id);
