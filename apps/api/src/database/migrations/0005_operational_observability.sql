-- Additive operational observability schema for RouteShare.
-- Existing core users/trips/requests/bookings/ledger remain authoritative.
CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id),
  role VARCHAR(16) NOT NULL CHECK (role IN ('passenger','driver','admin','operator')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  device_hash CHAR(64),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX user_sessions_user_idx ON user_sessions(user_id, started_at DESC);

-- One stable identity for events regardless of which device initiated them.
CREATE TABLE domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  aggregate_type VARCHAR(48) NOT NULL,
  aggregate_id UUID NOT NULL,
  actor_user_id UUID REFERENCES users(id),
  actor_role VARCHAR(16),
  actor_session_id UUID REFERENCES user_sessions(id),
  correlation_id UUID,
  causation_id UUID REFERENCES domain_events(id),
  idempotency_key VARCHAR(120) UNIQUE,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK (jsonb_typeof(payload) = 'object')
);
CREATE INDEX domain_events_aggregate_idx ON domain_events(aggregate_type, aggregate_id, occurred_at, id);
CREATE INDEX domain_events_actor_idx ON domain_events(actor_user_id, occurred_at DESC);
CREATE INDEX domain_events_correlation_idx ON domain_events(correlation_id, occurred_at);
CREATE INDEX domain_events_type_time_idx ON domain_events(event_type, occurred_at DESC);

-- Persist route stop order and actual milestones separately from a JSON offer snapshot.
CREATE TABLE trip_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_trip_id UUID NOT NULL REFERENCES driver_trips(id),
  passenger_request_id UUID REFERENCES passenger_requests(id),
  booking_id UUID REFERENCES bookings(id),
  stop_kind VARCHAR(16) NOT NULL CHECK (stop_kind IN ('origin','pickup','dropoff','destination')),
  sequence_no INTEGER NOT NULL CHECK (sequence_no >= 0),
  location geography(Point, 4326),
  address_label VARCHAR(200),
  planned_arrival_at TIMESTAMPTZ,
  actual_arrival_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','en_route','arrived','completed','skipped','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (stop_kind IN ('origin','destination') OR passenger_request_id IS NOT NULL)
);
CREATE INDEX trip_stops_trip_order_idx ON trip_stops(driver_trip_id, sequence_no);
CREATE INDEX trip_stops_booking_idx ON trip_stops(booking_id);

-- Samples are observations, not automatically verified truth.
CREATE TABLE location_samples (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  driver_trip_id UUID REFERENCES driver_trips(id),
  session_id UUID REFERENCES user_sessions(id),
  location geography(Point, 4326) NOT NULL,
  source VARCHAR(20) NOT NULL CHECK (source IN ('gps','network','sensor_fusion','manual','estimated','predicted')),
  accuracy_m REAL CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  confidence REAL CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  is_trusted BOOLEAN NOT NULL DEFAULT false,
  measured_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX location_samples_trip_time_idx ON location_samples(driver_trip_id, measured_at DESC);
CREATE INDEX location_samples_user_time_idx ON location_samples(user_id, measured_at DESC);
CREATE INDEX location_samples_location_gix ON location_samples USING GIST(location);

CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  opened_by_user_id UUID NOT NULL REFERENCES users(id),
  assigned_operator_id UUID REFERENCES users(id),
  reason_code VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','investigating','resolved','rejected','closed')),
  description TEXT,
  resolution_code VARCHAR(64),
  resolution_note TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);
CREATE INDEX disputes_booking_idx ON disputes(booking_id, opened_at DESC);
CREATE INDEX disputes_status_idx ON disputes(status, opened_at DESC);
CREATE TABLE dispute_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id),
  actor_user_id UUID REFERENCES users(id),
  action_type VARCHAR(64) NOT NULL,
  note TEXT,
  related_ledger_transaction_id UUID REFERENCES ledger_transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX dispute_actions_case_idx ON dispute_actions(dispute_id, created_at);

-- Transitional link: legacy test requests remain usable while account auth is implemented.
ALTER TABLE test_passenger_requests ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
CREATE INDEX IF NOT EXISTS test_passenger_requests_user_idx ON test_passenger_requests(user_id, created_at DESC);
