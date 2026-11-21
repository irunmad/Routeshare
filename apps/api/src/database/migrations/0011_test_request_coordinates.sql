-- Preserve the exact selected map coordinates; labels are display-only.
ALTER TABLE test_passenger_requests
  ADD COLUMN origin_lat DOUBLE PRECISION,
  ADD COLUMN origin_lon DOUBLE PRECISION,
  ADD COLUMN destination_lat DOUBLE PRECISION,
  ADD COLUMN destination_lon DOUBLE PRECISION;
ALTER TABLE test_passenger_requests
  ADD CONSTRAINT test_origin_coordinate_pair CHECK ((origin_lat IS NULL) = (origin_lon IS NULL)),
  ADD CONSTRAINT test_destination_coordinate_pair CHECK ((destination_lat IS NULL) = (destination_lon IS NULL)),
  ADD CONSTRAINT test_origin_coordinate_range CHECK (origin_lat BETWEEN -90 AND 90 AND origin_lon BETWEEN -180 AND 180),
  ADD CONSTRAINT test_destination_coordinate_range CHECK (destination_lat BETWEEN -90 AND 90 AND destination_lon BETWEEN -180 AND 180);
