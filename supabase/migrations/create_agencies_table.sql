-- ============================================================
-- Tabla de agencias con datos de facturación y contacto
-- ============================================================

CREATE TABLE IF NOT EXISTS agencies (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fantasy_name   text        NOT NULL,
  rut            text        NOT NULL UNIQUE,
  razon_social   text        NOT NULL,
  giro           text        NOT NULL,
  address        text        NOT NULL,
  comuna         text        NOT NULL,
  city           text        NOT NULL,
  billing_email  text,
  phone          text,
  contact_name   text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- FK opcional en bookings para vincular reservas a agencias registradas
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL;
