# API contract — planned v1

Base path: `/v1`. JSON over HTTPS. All write commands should accept an `Idempotency-Key` where retries could create duplicate effects.

## Identity
- `POST /auth/otp/request`
- `POST /auth/otp/verify`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /me`

## Routing
- `POST /routes/preview` — origin/destination to road route, distance and ETA.

## Passenger
- `POST /passenger/requests`
- `GET /passenger/requests/:id`
- `POST /passenger/requests/:id/cancel`

## Driver
- `POST /driver/trips`
- `GET /driver/trips/:id/offers`
- `POST /driver/trips/:id/offers/:offerId/accept`
- `POST /driver/trips/:id/cancel`

## Booking and trip
- `GET /bookings/:id`
- `POST /bookings/:id/cancel`
- `POST /bookings/:id/events` — pickup, drop-off and trip lifecycle events.

## Wallet / payments (PSP-backed)
- `GET /wallet`
- `GET /wallet/ledger`
- `POST /payments/topups`
- `POST /payouts`

## Realtime
WebSocket topics are authorization-scoped. Planned events: `request.matched`, `booking.confirmed`, `booking.cancelled`, `trip.location`, `trip.status_changed`.

This is a planning contract, not a claim that these endpoints are implemented yet.
