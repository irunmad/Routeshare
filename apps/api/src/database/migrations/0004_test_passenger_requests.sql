-- Shared cross-device test requests. These records are isolated from real bookings and wallets.
CREATE TABLE test_passenger_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID NOT NULL,
  origin_label VARCHAR(200) NOT NULL,
  destination_label VARCHAR(200) NOT NULL,
  departure_start TIMESTAMPTZ NOT NULL,
  departure_end TIMESTAMPTZ NOT NULL,
  offered_rate_minor_per_km INTEGER NOT NULL CHECK (offered_rate_minor_per_km >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'searching'
    CHECK (status IN ('searching', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  CHECK (departure_end >= departure_start),
  CHECK (length(trim(origin_label)) > 0),
  CHECK (length(trim(destination_label)) > 0)
);
CREATE INDEX test_passenger_requests_status_created_idx
  ON test_passenger_requests(status, created_at DESC);
CREATE INDEX test_passenger_requests_owner_status_idx
  ON test_passenger_requests(installation_id, status, created_at DESC);
