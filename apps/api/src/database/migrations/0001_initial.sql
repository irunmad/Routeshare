-- RouteShare initial relational model.
-- PostgreSQL 16+ with PostGIS. Apply with a migration runner in deployment.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE account_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE verification_status AS ENUM ('not_started', 'pending', 'verified', 'rejected');
CREATE TYPE trip_status AS ENUM ('draft', 'published', 'in_progress', 'completed', 'cancelled');
CREATE TYPE request_status AS ENUM ('draft', 'searching', 'matched', 'in_trip', 'completed', 'cancelled', 'expired');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'picked_up', 'completed', 'cancelled');
CREATE TYPE ledger_entry_direction AS ENUM ('debit', 'credit');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 VARCHAR(20) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  status account_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE driver_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  verification_status verification_status NOT NULL DEFAULT 'not_started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES driver_profiles(user_id),
  make VARCHAR(80) NOT NULL,
  model VARCHAR(80) NOT NULL,
  color VARCHAR(40),
  plate_number VARCHAR(20) NOT NULL,
  seat_capacity SMALLINT NOT NULL CHECK (seat_capacity BETWEEN 1 AND 8),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plate_number)
);

CREATE TABLE driver_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES driver_profiles(user_id),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  origin_label VARCHAR(200) NOT NULL,
  destination_label VARCHAR(200) NOT NULL,
  origin geography(Point, 4326) NOT NULL,
  destination geography(Point, 4326) NOT NULL,
  route_geometry geography(LineString, 4326),
  direct_distance_m INTEGER NOT NULL CHECK (direct_distance_m > 0),
  departure_start TIMESTAMPTZ NOT NULL,
  departure_end TIMESTAMPTZ NOT NULL,
  status trip_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (departure_end >= departure_start)
);
CREATE INDEX driver_trips_status_departure_idx ON driver_trips(status, departure_start);
CREATE INDEX driver_trips_origin_gix ON driver_trips USING GIST(origin);
CREATE INDEX driver_trips_destination_gix ON driver_trips USING GIST(destination);
CREATE INDEX driver_trips_route_gix ON driver_trips USING GIST(route_geometry);

CREATE TABLE passenger_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID NOT NULL REFERENCES users(id),
  origin_label VARCHAR(200) NOT NULL,
  destination_label VARCHAR(200) NOT NULL,
  origin geography(Point, 4326) NOT NULL,
  destination geography(Point, 4326) NOT NULL,
  route_geometry geography(LineString, 4326),
  route_distance_m INTEGER NOT NULL CHECK (route_distance_m > 0),
  offered_rate_minor_per_km INTEGER NOT NULL CHECK (offered_rate_minor_per_km >= 0),
  quoted_fare_minor INTEGER NOT NULL CHECK (quoted_fare_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'UAH' CHECK (currency = 'UAH'),
  departure_start TIMESTAMPTZ NOT NULL,
  departure_end TIMESTAMPTZ NOT NULL,
  seats SMALLINT NOT NULL DEFAULT 1 CHECK (seats BETWEEN 1 AND 8),
  status request_status NOT NULL DEFAULT 'draft',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (departure_end >= departure_start)
);
CREATE INDEX passenger_requests_status_departure_idx ON passenger_requests(status, departure_start);
CREATE INDEX passenger_requests_origin_gix ON passenger_requests USING GIST(origin);
CREATE INDEX passenger_requests_destination_gix ON passenger_requests USING GIST(destination);
CREATE INDEX passenger_requests_route_gix ON passenger_requests USING GIST(route_geometry);

CREATE TABLE trip_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_trip_id UUID NOT NULL REFERENCES driver_trips(id),
  stop_sequence JSONB NOT NULL,
  vehicle_distance_m INTEGER NOT NULL CHECK (vehicle_distance_m > 0),
  extra_distance_m INTEGER NOT NULL CHECK (extra_distance_m >= 0),
  passenger_revenue_minor BIGINT NOT NULL CHECK (passenger_revenue_minor >= 0),
  platform_fee_minor BIGINT NOT NULL CHECK (platform_fee_minor >= 0),
  driver_net_minor BIGINT NOT NULL CHECK (driver_net_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'UAH' CHECK (currency = 'UAH'),
  status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'accepted', 'expired', 'withdrawn')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trip_offers_trip_status_idx ON trip_offers(driver_trip_id, status, expires_at);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_offer_id UUID NOT NULL REFERENCES trip_offers(id),
  passenger_request_id UUID NOT NULL UNIQUE REFERENCES passenger_requests(id),
  passenger_id UUID NOT NULL REFERENCES users(id),
  seats SMALLINT NOT NULL CHECK (seats BETWEEN 1 AND 8),
  fare_minor BIGINT NOT NULL CHECK (fare_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'UAH' CHECK (currency = 'UAH'),
  status booking_status NOT NULL DEFAULT 'pending',
  accepted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bookings_offer_status_idx ON bookings(trip_offer_id, status);
CREATE INDEX bookings_passenger_status_idx ON bookings(passenger_id, status);

-- Ledger accounts are projections of immutable entries; never edit historical entries.
CREATE TABLE ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  account_type VARCHAR(24) NOT NULL CHECK (account_type IN ('passenger_wallet', 'driver_payable', 'platform_revenue')),
  currency CHAR(3) NOT NULL DEFAULT 'UAH' CHECK (currency = 'UAH'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id, account_type, currency)
);

CREATE TABLE ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(120) NOT NULL UNIQUE,
  reference_type VARCHAR(40) NOT NULL,
  reference_id UUID,
  description VARCHAR(240),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES ledger_transactions(id),
  account_id UUID NOT NULL REFERENCES ledger_accounts(id),
  direction ledger_entry_direction NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ledger_entries_account_created_idx ON ledger_entries(account_id, created_at DESC);
CREATE INDEX ledger_entries_transaction_idx ON ledger_entries(transaction_id);

-- The matching/booking service must lock the offer and affected requests,
-- re-check capacity and statuses, then write bookings and ledger reservations
-- in one database transaction. This migration intentionally does not expose
-- client-side writes to financial or lifecycle tables.
