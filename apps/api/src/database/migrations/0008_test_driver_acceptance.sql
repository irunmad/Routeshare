-- Isolated simulator booking: a single request can be claimed atomically.
ALTER TABLE test_passenger_requests DROP CONSTRAINT IF EXISTS test_passenger_requests_status_check;
ALTER TABLE test_passenger_requests ADD CONSTRAINT test_passenger_requests_status_check
  CHECK (status IN ('searching','accepted','cancelled'));
ALTER TABLE test_passenger_requests
  ADD COLUMN accepted_driver_user_id UUID REFERENCES users(id),
  ADD COLUMN accepted_at TIMESTAMPTZ;
CREATE INDEX test_requests_driver_idx ON test_passenger_requests(accepted_driver_user_id, accepted_at DESC);
ALTER TABLE test_request_events DROP CONSTRAINT IF EXISTS test_request_events_event_type_check;
ALTER TABLE test_request_events ADD CONSTRAINT test_request_events_event_type_check
  CHECK (event_type IN ('request.created','request.cancelled','request.accepted'));
