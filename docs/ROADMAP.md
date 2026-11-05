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
