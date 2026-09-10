CREATE TABLE IF NOT EXISTS member_payment_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid        NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  type        text        NOT NULL
    CHECK (type IN ('tour','servicio','bono','sueldo','otro')),
  description text        NOT NULL,
  amount      int         NOT NULL CHECK (amount > 0),
  item_date   date,
  status      text        NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente','pagado')),
  paid_at     timestamptz,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_payment_items_member
  ON member_payment_items(member_id);

CREATE INDEX IF NOT EXISTS idx_member_payment_items_status
  ON member_payment_items(member_id, status);
