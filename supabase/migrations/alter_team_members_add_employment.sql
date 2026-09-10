ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS employment_type         text DEFAULT 'contrato'
    CHECK (employment_type IN ('contrato','honorarios')),
  ADD COLUMN IF NOT EXISTS contract_type           text
    CHECK (contract_type IN ('indefinido','plazo_fijo','por_obra')),
  ADD COLUMN IF NOT EXISTS contract_start          date,
  ADD COLUMN IF NOT EXISTS contract_end            date,
  ADD COLUMN IF NOT EXISTS afp                     text,
  ADD COLUMN IF NOT EXISTS health_insurance_type   text
    CHECK (health_insurance_type IN ('isapre','fonasa')),
  ADD COLUMN IF NOT EXISTS health_insurance_name   text,
  ADD COLUMN IF NOT EXISTS salary_base             int,
  ADD COLUMN IF NOT EXISTS has_bonus               boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bonus_description       text,
  ADD COLUMN IF NOT EXISTS honorarios_payment_type text
    CHECK (honorarios_payment_type IN ('per_tour','per_service','both')),
  ADD COLUMN IF NOT EXISTS honorarios_rate_per_tour int,
  ADD COLUMN IF NOT EXISTS languages               text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS license_class           text,
  ADD COLUMN IF NOT EXISTS bank_name               text,
  ADD COLUMN IF NOT EXISTS bank_account_type       text
    CHECK (bank_account_type IN ('corriente','vista','ahorro','rut')),
  ADD COLUMN IF NOT EXISTS bank_account_number     text,
  ADD COLUMN IF NOT EXISTS address                 text,
  ADD COLUMN IF NOT EXISTS civil_status            text
    CHECK (civil_status IN ('soltero','casado','divorciado','viudo','conviviente')),
  ADD COLUMN IF NOT EXISTS blood_type              text,
  ADD COLUMN IF NOT EXISTS allergies               text;

-- Ampliar tipos de documentos del equipo
ALTER TABLE member_documents DROP CONSTRAINT IF EXISTS member_documents_type_check;
ALTER TABLE member_documents ADD CONSTRAINT member_documents_type_check
  CHECK (type IN (
    'contrato','cedula','licencia','primeros_auxilios',
    'certificado_antecedentes','psicotecnico','examen_medico','otro'
  ));
