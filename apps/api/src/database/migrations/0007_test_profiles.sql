-- Test identity bridge: real users.id as stable business key, no OTP/auth yet.
-- UUID supplied by test client is only a simulator selector, NOT authentication.
CREATE TABLE test_profiles (
  profile_id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  display_name VARCHAR(100) NOT NULL,
  phone_label VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX test_profiles_user_idx ON test_profiles(user_id);
