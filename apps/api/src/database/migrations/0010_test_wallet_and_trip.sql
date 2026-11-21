-- Isolated virtual accounting sandbox; no payment provider, no real funds.
CREATE TABLE test_wallet_accounts (
  user_id UUID NOT NULL REFERENCES users(id),
  account_kind VARCHAR(16) NOT NULL CHECK (account_kind IN ('passenger','driver','platform','test_source')),
  balance_minor BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, account_kind)
);
CREATE TABLE test_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('topup','ride_settlement')),
  request_id UUID REFERENCES test_passenger_requests(id),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  platform_fee_minor BIGINT NOT NULL DEFAULT 0 CHECK (platform_fee_minor >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, request_id)
);
CREATE TABLE test_wallet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES test_wallet_transactions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  account_kind VARCHAR(16) NOT NULL CHECK (account_kind IN ('passenger','driver','platform','test_source')),
  delta_minor BIGINT NOT NULL CHECK (delta_minor <> 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, account_kind) REFERENCES test_wallet_accounts(user_id, account_kind)
);
CREATE INDEX test_wallet_entries_transaction_idx ON test_wallet_entries(transaction_id);
CREATE INDEX test_wallet_transactions_actor_idx ON test_wallet_transactions(actor_user_id, created_at DESC);
ALTER TABLE test_passenger_requests DROP CONSTRAINT IF EXISTS test_passenger_requests_status_check;
ALTER TABLE test_passenger_requests ADD CONSTRAINT test_passenger_requests_status_check
 CHECK (status IN ('searching','accepted','in_trip','completed','cancelled'));
ALTER TABLE test_passenger_requests ADD COLUMN completed_at TIMESTAMPTZ;
ALTER TABLE test_request_events DROP CONSTRAINT IF EXISTS test_request_events_event_type_check;
ALTER TABLE test_request_events ADD CONSTRAINT test_request_events_event_type_check
 CHECK (event_type IN ('request.created','request.cancelled','request.accepted','request.driver_released','request.started','request.completed'));
