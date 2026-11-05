# Delivery roadmap

## Foundation
- [x] Confirm product baseline and fare model
- [x] Establish monorepo and initial architecture
- [x] Add API health endpoint and shared domain primitives
- [ ] Verify workspace install and cloud preview

## MVP implementation
1. Database schema, migrations and PostGIS setup
2. Phone OTP authentication and user profiles
3. Geocoding and road-route preview provider
4. Driver vehicles and published trips
5. Passenger requests, fare quote and searching state
6. Live request map and road-distance discovery filters for passengers/drivers
7. Driver matching modes: flexible and destination-oriented; rank full combinations by revenue per actual vehicle km
8. Matching: route feasibility, ordered pickups/drop-offs, capacity, time windows and detour
9. Atomic provisional offer acceptance, 10-second free cancellation window and seat/fund reservation
10. Realtime map updates, push/in-app alerts, trip status, safety, ratings and admin tools
11. PSP sandbox, immutable ledger and refunds

## Launch readiness
- Legal review of marketplace, payment flow, privacy and consumer terms in Ukraine
- Security review, abuse prevention, audit logging and incident procedures
- Load, concurrency, route quality and mobile network testing


## Immediate cross-device test milestone (before full matching/payment)

Goal: allow two or more phones to exchange real requests through the deployed API as soon as possible.

1. **Shared test identity/session**: create a lightweight development identity per installation/device without mandatory SMS. Clearly mark it as test mode; do not treat it as production authentication.
2. **Create passenger request**: connect the passenger form to the API and persist the request in PostgreSQL with canonical request ID, route labels/coordinates, departure window, offered rate and searching status.
3. **Live request feed**: expose a server endpoint returning active searching requests; mobile clients refresh via realtime transport if available, with short-interval polling as a reliable first milestone.
4. **Cross-phone acceptance test**: Phone A creates a request; Phone B sees it in the live list/map feed within a few seconds; cancelling on A removes it from B after the next server update.
5. **Publish driver route**: connect driver route form to the same shared backend and show it on passenger devices.
6. **Map and filters**: after the shared request feed is verified, add map/list switch and road-distance filters. Do not substitute straight-line distance for road-network filters.
7. Add proper user authentication, push notifications, route combinations, atomic acceptance and the 10-second cancellation lifecycle after the basic multi-device flow is stable.

Testing milestone is not a production launch: no real payments, no public personal contact details, and development identity must be replaceable by verified authentication later.
