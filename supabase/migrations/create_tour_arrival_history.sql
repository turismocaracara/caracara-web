CREATE TABLE IF NOT EXISTS tour_arrival_history (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_slug    text        NOT NULL REFERENCES tours(slug) ON DELETE CASCADE,
  arrival_time text        NOT NULL,
  recorded_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tour_arrival_history_slug_at
  ON tour_arrival_history (tour_slug, recorded_at DESC);
