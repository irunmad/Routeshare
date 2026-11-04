# Architecture

## High-level shape

A TypeScript monorepo with a mobile client, modular API and shared domain contracts.

```
Expo / React Native
        |
     HTTPS + WebSocket
        |
      NestJS API
        |
  PostgreSQL + PostGIS
        |
 Routing adapter / PSP adapter / OTP provider
```

## Backend modules

- identity: phone OTP, sessions, account and profile
- drivers: driver profile, vehicle and verification state
- routing: geocoding and route calculation behind provider interfaces
- trips: driver-published routes, departure windows and seats
- requests: passenger origin/destination, rate offer and lifecycle
- matching: candidate generation, stop sequencing, capacity/time/detour checks and ranking
- bookings: atomic acceptance, seat reservations and state machine
- payments: PSP integration, authorizations, refunds and payouts
- ledger: immutable financial entries and balance projections
- realtime: trip and booking events
- trust: ratings, reports, support and safety controls
- admin: moderation, disputes and operational controls

## Key design rules

1. PostgreSQL is the system of record.
2. Use PostGIS for spatial filtering; use a routing engine for road-network distance and ETA. Straight-line distance is only a coarse pre-filter.
3. Keep routing and payment vendors behind interfaces so providers can be replaced.
4. Use database transactions and row-level locking or equivalent concurrency control for accepting a combination.
5. Add idempotency keys to payment and booking commands.
6. Keep money in integer minor units and persist currency explicitly.
7. Persist every important state transition with actor, timestamp and reason.
8. Do not expose a passenger's precise live location to drivers before the appropriate booking/trip stage.

## Mobile strategy

One app with two role modes. Design for narrow screens and intermittent mobile connectivity. Keep maps and live location behind client services so the UI can be tested with mocked routes.
