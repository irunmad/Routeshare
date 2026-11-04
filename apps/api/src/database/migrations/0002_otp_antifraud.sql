-- OTP anti-abuse foundations. Identifiers are stored as keyed HMAC hashes, not raw values.
CREATE TABLE otp_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_hash CHAR(64) NOT NULL,
  phone_hash CHAR(64) NOT NULL,
  ip_hash CHAR(64),
  outcome VARCHAR(16) NOT NULL DEFAULT 'reserved'
    CHECK (outcome IN ('reserved', 'sent', 'failed', 'blocked')),
  provider VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX otp_events_device_created_idx ON otp_request_events(device_hash, created_at DESC);
CREATE INDEX otp_events_phone_created_idx ON otp_request_events(phone_hash, created_at DESC);
CREATE INDEX otp_events_ip_created_idx ON otp_request_events(ip_hash, created_at DESC) WHERE ip_hash IS NOT NULL;

CREATE TABLE device_account_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_hash CHAR(64) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(device_hash, user_id)
);
CREATE INDEX device_account_links_device_linked_idx ON device_account_links(device_hash, linked_at DESC);
