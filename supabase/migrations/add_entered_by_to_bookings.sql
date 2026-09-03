-- ============================================================
-- Migración: entered_by en bookings
-- Registra qué miembro del equipo ingresó cada reserva manual.
-- Ejecutar en Supabase SQL Editor → Run.
-- ============================================================

DO $$
BEGIN
  -- 1. Agregar columna si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'entered_by'
  ) THEN
    ALTER TABLE bookings ADD COLUMN entered_by uuid;
    RAISE NOTICE 'Columna entered_by agregada a bookings';
  ELSE
    RAISE NOTICE 'Columna entered_by ya existe en bookings';
  END IF;

  -- 2. Agregar FK a team_members si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'bookings'
      AND constraint_name = 'bookings_entered_by_fkey'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_entered_by_fkey
      FOREIGN KEY (entered_by)
      REFERENCES team_members(id)
      ON DELETE SET NULL;
    RAISE NOTICE 'FK bookings_entered_by_fkey creada';
  ELSE
    RAISE NOTICE 'FK bookings_entered_by_fkey ya existe';
  END IF;
END $$;
