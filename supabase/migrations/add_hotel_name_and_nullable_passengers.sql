-- ============================================================
-- Migración: hotel_name en passengers + campos nullable
-- hotel_name: hospedaje donde está el grupo
-- Campos opcionales para titulares de agencias grupales
-- Ejecutar en Supabase SQL Editor → Run.
-- ============================================================

-- Agregar campo de hospedaje
ALTER TABLE passengers
  ADD COLUMN IF NOT EXISTS hotel_name text;

-- Hacer opcionales los campos que no siempre están disponibles
-- (especialmente para titulares de agencias grupales)
ALTER TABLE passengers
  ALTER COLUMN id_type   DROP NOT NULL,
  ALTER COLUMN id_number DROP NOT NULL,
  ALTER COLUMN email     DROP NOT NULL,
  ALTER COLUMN phone     DROP NOT NULL,
  ALTER COLUMN country   DROP NOT NULL;
