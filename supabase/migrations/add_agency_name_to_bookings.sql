-- ============================================================
-- Migración: agency_name en bookings
-- Registra si la reserva proviene de una agencia externa y cuál.
-- NULL = cliente directo de CaraCara.
-- Ejecutar en Supabase SQL Editor → Run.
-- ============================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS agency_name text;
