-- Test-only acceptance grace period and cancellation audit.
ALTER TABLE test_request_events DROP CONSTRAINT IF EXISTS test_request_events_event_type_check;
ALTER TABLE test_request_events ADD CONSTRAINT test_request_events_event_type_check
  CHECK (event_type IN ('request.created','request.cancelled','request.accepted','request.driver_released'));
