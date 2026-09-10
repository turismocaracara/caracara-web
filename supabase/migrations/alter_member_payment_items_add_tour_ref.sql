-- Vincular ítems de pago a instancias de tour para trazabilidad automática
ALTER TABLE member_payment_items
  ADD COLUMN IF NOT EXISTS tour_instance_id uuid REFERENCES tour_instances(id) ON DELETE CASCADE;

-- Un miembro solo puede tener un ítem de pago por instancia de tour
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_payment_items_tour_unique
  ON member_payment_items(member_id, tour_instance_id)
  WHERE tour_instance_id IS NOT NULL;
