-- ============================================================
-- TURISMO CARACARA — Schema Fase A
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

-- ─── CONFIGURACIÓN DEL SISTEMA ──────────────────────────────
CREATE TABLE IF NOT EXISTS config (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- ─── VANS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vans (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  capacity   int  NOT NULL DEFAULT 9,
  plate      text,
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ─── TOURS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tours (
  slug                  text PRIMARY KEY,
  name_es               text NOT NULL,
  name_en               text,
  name_pt               text,
  category              text,
  duration_hours        int,
  available_months      int[] DEFAULT '{1,2,3,4,5,6,7,8,9,10,11,12}',
  group_min_pax         int DEFAULT 4,
  booking_cutoff_time   time DEFAULT '20:00',
  booking_cutoff_hours  int,
  has_picnic            boolean DEFAULT false,
  active                boolean DEFAULT true,
  created_at            timestamptz DEFAULT now()
);

-- ─── PRECIOS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private_pricing (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_slug       text NOT NULL REFERENCES tours(slug) ON DELETE CASCADE,
  pax_min         int  NOT NULL,
  pax_max         int  NOT NULL,
  price_per_person int NOT NULL,
  valid_from      date,
  valid_to        date,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_pricing (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_slug       text NOT NULL REFERENCES tours(slug) ON DELETE CASCADE,
  price_per_person int NOT NULL,
  valid_from      date,
  valid_to        date,
  created_at      timestamptz DEFAULT now()
);

-- ─── HORARIOS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tour_schedules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_slug  text NOT NULL REFERENCES tours(slug) ON DELETE CASCADE,
  season     text NOT NULL,  -- 'summer' | 'winter'
  pickup_time time NOT NULL
);

-- ─── DISPONIBILIDAD / BLOQUEOS ──────────────────────────────
CREATE TABLE IF NOT EXISTS van_blocks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  van_id     uuid NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  date       date NOT NULL,
  reason     text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recurring_blackouts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_slug  text REFERENCES tours(slug) ON DELETE CASCADE,  -- null = aplica a todos
  month      int NOT NULL CHECK (month BETWEEN 1 AND 12),
  day        int NOT NULL CHECK (day BETWEEN 1 AND 31),
  reason     text,
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tour_blackout_dates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_slug  text REFERENCES tours(slug) ON DELETE CASCADE,  -- null = aplica a todos
  date       date NOT NULL,
  reason     text,
  created_at timestamptz DEFAULT now()
);

-- ─── INSTANCIAS DE TOUR ─────────────────────────────────────
-- 1 tour_instance = 1 van × 1 tour × 1 fecha
CREATE TABLE IF NOT EXISTS tour_instances (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_slug    text NOT NULL REFERENCES tours(slug),
  date         date NOT NULL,
  booking_type text NOT NULL CHECK (booking_type IN ('private', 'group')),
  van_id       uuid REFERENCES vans(id),
  current_pax  int DEFAULT 0,
  max_pax      int DEFAULT 9,
  status       text DEFAULT 'forming' CHECK (status IN ('forming', 'confirmed', 'executed', 'cancelled')),
  outsourced   boolean DEFAULT false,
  guide_notes  text,
  created_at   timestamptz DEFAULT now()
);

-- ─── CLIENTES (CRM) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text NOT NULL,
  phone      text,
  country    text,
  id_type    text CHECK (id_type IN ('rut', 'passport')),
  id_number  text,
  locale     text DEFAULT 'es',
  tags       jsonb DEFAULT '[]',
  notes      text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS clients_email_idx ON clients(lower(email));

-- ─── RESERVAS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_instance_id     uuid REFERENCES tour_instances(id),
  client_id            uuid NOT NULL REFERENCES clients(id),
  booking_type         text NOT NULL CHECK (booking_type IN ('private', 'group')),
  source               text DEFAULT 'online' CHECK (source IN ('online', 'manual', 'whatsapp')),
  pax                  int NOT NULL,
  price_per_person     int,
  total_amount         int,
  booking_code         text UNIQUE NOT NULL,
  status               text DEFAULT 'pending' CHECK (
    status IN ('reserved', 'pending_payment', 'waiting_min', 'confirmed', 'cancelled', 'refunded')
  ),
  reserved_until       timestamptz,
  mp_preference_id     text,
  mp_payment_id        text,
  cancelled_at         timestamptz,
  cancellation_reason  text CHECK (
    cancellation_reason IN ('client_request', 'min_not_reached', 'force_majeure')
  ),
  cancellation_by      text CHECK (cancellation_by IN ('client', 'admin', 'system')),
  refund_amount        int,
  refund_status        text CHECK (
    refund_status IN ('pending_approval', 'approved', 'processed', 'not_applicable', 'credit_issued')
  ),
  refund_processed_at  timestamptz,
  cancellation_token   text UNIQUE,
  credit_applied       int DEFAULT 0,
  credit_id            uuid,
  internal_notes       text,
  locale               text DEFAULT 'es',
  amount_usd_approx    int,
  fx_rate_at_booking   numeric(10,4),
  display_currency     text,
  created_at           timestamptz DEFAULT now()
);

-- Secuencia para booking_code (CC-2026-XXXX)
CREATE SEQUENCE IF NOT EXISTS booking_seq START 1;

-- Función RPC para obtener el siguiente valor de la secuencia
CREATE OR REPLACE FUNCTION get_next_booking_seq()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT nextval('booking_seq')::integer;
$$;

-- ─── PASAJEROS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS passengers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  name            text NOT NULL,
  id_type         text CHECK (id_type IN ('rut', 'passport')),
  id_number       text NOT NULL,
  email           text NOT NULL,
  phone           text NOT NULL,
  country         text NOT NULL,
  is_lead         boolean DEFAULT false,
  pickup_type     text DEFAULT 'address' CHECK (pickup_type IN ('address', 'meeting_point', 'own_transport')),
  pickup_address  text,
  pickup_lat      numeric(10,7),
  pickup_lng      numeric(10,7),
  created_at      timestamptz DEFAULT now()
);

-- ─── POLÍTICAS DE CANCELACIÓN ───────────────────────────────
CREATE TABLE IF NOT EXISTS cancellation_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_slug       text REFERENCES tours(slug) ON DELETE CASCADE,  -- null = política global
  days_before_min int NOT NULL,
  days_before_max int,  -- null = sin límite superior
  refund_percent  int NOT NULL CHECK (refund_percent BETWEEN 0 AND 100),
  active          boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- ─── CRÉDITOS DE CLIENTES ───────────────────────────────────
CREATE TABLE IF NOT EXISTS client_credits (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL REFERENCES clients(id),
  amount_clp          int NOT NULL,
  reason              text CHECK (reason IN ('min_not_reached', 'force_majeure', 'goodwill', 'manual')),
  code                text UNIQUE,  -- null = automático por email; valor = código manual
  expires_at          timestamptz,
  used_at             timestamptz,
  used_in_booking_id  uuid REFERENCES bookings(id),
  created_at          timestamptz DEFAULT now()
);

-- ─── EQUIPO INTERNO ─────────────────────────────────────────
-- (Fase D — se agrega cuando se implemente el panel admin + PWA)
-- CREATE TABLE IF NOT EXISTS team_members (...)

-- ============================================================
-- SEED — Datos iniciales
-- ============================================================

-- Config del sistema
INSERT INTO config (key, value) VALUES
  ('group_confirmation_deadline', '"20:00"'),
  ('payment_hold_minutes', '20'),
  ('whatsapp_number', '"+56991384957"'),
  ('refund_reminder_hours', '48'),
  ('exchange_rates', '{"USD": 950, "BRL": 5.2, "EUR": 1030}')
ON CONFLICT (key) DO NOTHING;

-- 2 vans
INSERT INTO vans (id, name, capacity, active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Van 1', 9, true),
  ('22222222-2222-2222-2222-222222222222', 'Van 2', 9, true)
ON CONFLICT DO NOTHING;

-- Política de cancelación global (aplica a todos los tours)
INSERT INTO cancellation_policies (tour_slug, days_before_min, days_before_max, refund_percent) VALUES
  (null, 9,  null, 100),
  (null, 7,  8,    75),
  (null, 5,  6,    50),
  (null, 3,  4,    25),
  (null, 1,  2,    0),
  (null, 0,  0,    0)
ON CONFLICT DO NOTHING;

-- Feriados chilenos (recurrentes por día/mes)
INSERT INTO recurring_blackouts (tour_slug, month, day, reason) VALUES
  (null, 1, 1,   'Año Nuevo'),
  (null, 5, 1,   'Día del Trabajo'),
  (null, 5, 21,  'Glorias Navales'),
  (null, 6, 20,  'Día de los Pueblos Indígenas'),
  (null, 7, 16,  'Virgen del Carmen'),
  (null, 8, 15,  'Asunción de la Virgen'),
  (null, 9, 18,  'Independencia Nacional'),
  (null, 9, 19,  'Glorias del Ejército'),
  (null, 10, 12, 'Día del Encuentro de dos Mundos'),
  (null, 10, 27, 'Día de las Iglesias Evangélicas'),
  (null, 11, 1,  'Día de Todos los Santos'),
  (null, 12, 8,  'Inmaculada Concepción'),
  (null, 12, 25, 'Navidad')
ON CONFLICT DO NOTHING;

-- ─── TOURS — 25 tours desde lib/tours.ts ────────────────────
INSERT INTO tours (slug, name_es, name_en, name_pt, category, duration_hours, has_picnic, active) VALUES
  ('embalse-el-yeso',        'Embalse El Yeso',           'El Yeso Reservoir',       'Represa El Yeso',            'cajon',      9,  false, true),
  ('el-yeso-las-melosas',    'El Yeso + Las Melosas',     'El Yeso + Las Melosas',   'El Yeso + Las Melosas',      'cajon',      10, false, true),
  ('el-yeso-termas-colina',  'El Yeso + Termas de Colina','El Yeso + Colina Hot Springs','El Yeso + Termas de Colina','cajon',   11, false, true),
  ('cajon-del-maipo-panoramico','Cajón del Maipo Panorámico','Maipo Canyon Panoramic','Cajón del Maipo Panorâmico','cajon',      8,  false, true),
  ('termas-valle-colina',    'Termas Valle de Colina',    'Colina Valley Hot Springs','Termas Vale de Colina',      'cajon',      11, false, true),
  ('valparaiso-vina-del-mar','Valparaíso + Viña del Mar', 'Valparaíso + Viña del Mar','Valparaíso + Viña del Mar',  'valparaiso', 9,  false, true),
  ('valparaiso-vinedo',      'Valparaíso + Viñedo',       'Valparaíso + Winery',     'Valparaíso + Vinhedo',       'valparaiso', 10, true,  true),
  ('isla-negra-undurraga',   'Isla Negra + Undurraga',    'Isla Negra + Undurraga',  'Isla Negra + Undurraga',     'valparaiso', 10, true,  true),
  ('valparaiso-casas-del-bosque','Valparaíso + Casas del Bosque','Valparaíso + Casas del Bosque','Valparaíso + Casas del Bosque','valparaiso',10,true,true),
  ('andes-panoramico',       'Andes Panorámico',          'Panoramic Andes',         'Andes Panorâmico',           'santiago',   7,  false, true),
  ('city-tour-santiago',     'City Tour Santiago',        'Santiago City Tour',      'City Tour Santiago',         'santiago',   6,  false, true),
  ('tour-casablanca',        'Tour Casablanca',           'Casablanca Tour',         'Tour Casablanca',            'vinedos',    9,  true,  true),
  ('tour-premium',           'Tour Premium',              'Premium Tour',            'Tour Premium',               'vinedos',    10, true,  true),
  ('tour-colchagua',         'Tour Colchagua',            'Colchagua Tour',          'Tour Colchagua',             'vinedos',    12, true,  true),
  ('tour-santa-rita',        'Tour Santa Rita',           'Santa Rita Tour',         'Tour Santa Rita',            'vinedos',    8,  true,  true),
  ('tour-santiago-wines',    'Tour Santiago Wines',       'Santiago Wines Tour',     'Tour Santiago Vinhos',       'vinedos',    8,  true,  true),
  ('sunset-alyan',           'Sunset Alyan',              'Sunset Alyan',            'Sunset Alyan',               'vinedos',    7,  true,  true),
  ('mirador-condores',       'Mirador de Cóndores',       'Condor Viewpoint',        'Mirante dos Cóndores',       'trekking',   8,  false, true),
  ('glaciar-el-morado',      'Glaciar El Morado',         'El Morado Glacier',       'Glaciar El Morado',          'trekking',   10, false, true),
  ('laguna-del-inca',        'Laguna del Inca',           'Inca Lagoon',             'Laguna do Inca',             'trekking',   10, false, true),
  ('parque-la-campana',      'Parque La Campana',         'La Campana Park',         'Parque La Campana',          'trekking',   9,  false, true),
  ('lagunillas-rafting',     'Lagunillas + Rafting',      'Lagunillas + Rafting',    'Lagunillas + Rafting',       'trekking',   10, false, true),
  ('rafting-asado',          'Rafting + Asado',           'Rafting + BBQ',           'Rafting + Churrasco',        'aventura',   8,  false, true),
  ('cabalgata-lo-barnechea', 'Cabalgata Lo Barnechea',    'Horseback Riding Lo Barnechea','Cavalgada Lo Barnechea', 'aventura',   5,  false, true),
  ('parque-farellones',      'Parque Farellones',         'Farellones Park',         'Parque Farellones',          'aventura',   8,  false, true)
ON CONFLICT (slug) DO NOTHING;
