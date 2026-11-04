# Domain model — initial entities

All IDs are UUIDs. Timestamps are UTC. Distances are stored in metres; durations in seconds; money in integer minor units with ISO currency code.

- **User**: id, phone, display_name, status, created_at
- **DriverProfile**: user_id, verification_status, rating_summary
- **Vehicle**: id, driver_id, make, model, color, plate_number, seat_capacity, status
- **PassengerRequest**: id, passenger_id, origin, destination, route_geometry, route_distance_m, offered_rate_minor_per_km, estimated_fare_minor, departure_window, status, expires_at
- **DriverTrip**: id, driver_id, vehicle_id, origin, destination, route_geometry, direct_distance_m, departure_window, status
- **TripOffer**: id, driver_trip_id, ordered_stops, passenger_request_ids, vehicle_distance_m, passenger_revenue_minor, platform_fee_minor, driver_net_minor, status, expires_at
- **Booking**: id, trip_offer_id, passenger_request_id, passenger_id, seat_count, fare_minor, status, accepted_at, cancelled_at
- **LedgerAccount**: id, owner_type, owner_id, currency
- **LedgerEntry**: id, account_id, transaction_id, direction, amount_minor, entry_type, reference_type, reference_id, created_at
- **Payment**: id, user_id, provider, provider_reference, amount_minor, currency, status, idempotency_key
- **TripEvent**: id, driver_trip_id, actor_id, event_type, payload, created_at

## Important distinctions

Passenger route distance is not the same as the driver's vehicle distance. The driver's vehicle distance includes travel to pickups, between stops and to drop-offs. Passenger fare is calculated independently for each passenger's own route and offered rate.

## State machines (first draft)

PassengerRequest: draft → searching → matched → in_trip → completed; searching/matched may transition to cancelled or expired.

DriverTrip: draft → published → in_progress → completed; published may transition to cancelled.

Booking: pending → confirmed → picked_up → completed; confirmed may transition to cancelled. Cancellation fees/refunds depend on a separately approved policy.

These transitions must be enforced server-side; clients may request transitions but cannot set arbitrary statuses.
