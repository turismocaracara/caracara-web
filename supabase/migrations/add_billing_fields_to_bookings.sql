-- ============================================================
-- Campos de cobranza para reservas manuales
-- ============================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_status  text
    CHECK (payment_status IN ('pending', 'partial', 'paid')),
  ADD COLUMN IF NOT EXISTS payment_method  text
    CHECK (payment_method IN ('cash', 'transfer', 'deposit', 'mercadopago', 'invoice', 'other')),
  ADD COLUMN IF NOT EXISTS amount_paid     int,
  ADD COLUMN IF NOT EXISTS receipt_ref     text,
  ADD COLUMN IF NOT EXISTS billing_notes   text;
