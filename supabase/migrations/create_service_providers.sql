-- Proveedores externos de servicio (guías freelance, agencias que operan tours)
CREATE TABLE IF NOT EXISTS service_providers (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  type       text        NOT NULL CHECK (type IN ('guide', 'agency')),
  phone      text,
  email      text,
  rut        text,
  notes      text,
  active     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
