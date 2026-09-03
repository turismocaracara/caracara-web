-- ============================================================
-- Historial de picnic y duración por tour
-- Permite calcular el promedio para pre-rellenar el toggle
-- ============================================================

CREATE TABLE IF NOT EXISTS tour_picnic_history (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_slug  text        NOT NULL,
  booking_id uuid        REFERENCES bookings(id) ON DELETE SET NULL,
  had_picnic boolean     NOT NULL,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tour_picnic_history_slug_idx ON tour_picnic_history (tour_slug, created_at DESC);

CREATE TABLE IF NOT EXISTS tour_duration_history (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_slug      text        NOT NULL,
  booking_id     uuid        REFERENCES bookings(id) ON DELETE SET NULL,
  duration_hours numeric(4,1) NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tour_duration_history_slug_idx ON tour_duration_history (tour_slug, created_at DESC);
