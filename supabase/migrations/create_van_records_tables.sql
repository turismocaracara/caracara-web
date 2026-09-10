-- Documentos del vehículo (unique por van + tipo)
CREATE TABLE IF NOT EXISTS van_documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  van_id        uuid        NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  type          text        NOT NULL CHECK (type IN ('revision_tecnica','soap','permiso_circulacion','seguro_voluntario','otro')),
  expires_at    date,
  issuer        text,
  policy_number text,
  notes         text,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (van_id, type)
);

-- Registro de kilometraje
CREATE TABLE IF NOT EXISTS van_odometer (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  van_id      uuid        NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  km          int         NOT NULL,
  recorded_at date        NOT NULL DEFAULT CURRENT_DATE,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

-- Mantenciones
CREATE TABLE IF NOT EXISTS van_maintenance (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  van_id      uuid        NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  date        date        NOT NULL DEFAULT CURRENT_DATE,
  type        text,
  description text,
  cost        int,
  workshop    text,
  km_at       int,
  next_km     int,
  created_at  timestamptz DEFAULT now()
);

-- Cargas de combustible
CREATE TABLE IF NOT EXISTS van_fuel (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  van_id      uuid        NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  date        date        NOT NULL DEFAULT CURRENT_DATE,
  liters      numeric(7,2),
  cost        int,
  km_at       int,
  station     text,
  created_at  timestamptz DEFAULT now()
);

-- Costos de tag mensuales (unique por van + mes)
CREATE TABLE IF NOT EXISTS van_tag_costs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  van_id     uuid        NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  month      date        NOT NULL,
  cost       int         NOT NULL,
  notes      text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (van_id, month)
);

CREATE INDEX IF NOT EXISTS idx_van_odometer_van   ON van_odometer   (van_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_van_maintenance_van ON van_maintenance (van_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_van_fuel_van        ON van_fuel        (van_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_van_tag_van         ON van_tag_costs   (van_id, month DESC);
