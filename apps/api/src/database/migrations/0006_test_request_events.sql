-- Test-only audit trail. Kept separate from production domain_events until
-- local test profiles are bound to authenticated users.
CREATE TABLE test_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES test_passenger_requests(id),
  actor_profile_id UUID NOT NULL,
  event_type VARCHAR(40) NOT NULL CHECK (event_type IN ('request.created','request.cancelled')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX test_request_events_request_time_idx ON test_request_events(request_id, occurred_at, id);
CREATE INDEX test_request_events_actor_time_idx ON test_request_events(actor_profile_id, occurred_at DESC);
