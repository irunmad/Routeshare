-- Expire abandoned OTP reservations quickly; only successful sends consume the long window.
ALTER TABLE otp_request_events
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

UPDATE otp_request_events
SET finalized_at = created_at
WHERE outcome IN ('sent', 'failed') AND finalized_at IS NULL;

CREATE INDEX IF NOT EXISTS otp_events_reserved_created_idx
  ON otp_request_events(created_at)
  WHERE outcome = 'reserved';
