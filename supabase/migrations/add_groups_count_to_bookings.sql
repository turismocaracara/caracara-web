-- ============================================================
-- Migración: groups_count en bookings
-- Registra cuántos sub-grupos envía una agencia en una reserva.
-- Solo aplica a reservas de agencia + tour grupal.
-- Ejecutar en Supabase SQL Editor → Run.
-- ============================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS groups_count int;

-- Opcional: si los pasajeros no-titulares fallan por NOT NULL en
-- email/phone/country, ejecutar también:
-- ALTER TABLE passengers
--   ALTER COLUMN email   DROP NOT NULL,
--   ALTER COLUMN phone   DROP NOT NULL,
--   ALTER COLUMN country DROP NOT NULL;
