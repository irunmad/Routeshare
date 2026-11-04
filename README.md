# RouteShare

Mobile-first ride matching for city and intercity trips. Drivers publish routes and available seats; passengers request their own origin–destination trips. The platform proposes compatible combinations while accounting for detours, capacity, timing and driver economics.

## Product rules
- One mobile app; one account may use Passenger and Driver modes.
- Passenger fare = that passenger's route distance × that passenger's offered UAH/km rate.
- Raising one passenger's offer never changes another passenger's rate.
- Passenger route distance and driver's actual vehicle distance are separate metrics. Vehicle distance includes pickups, drop-offs and detours.
- Booking must reserve seats and funds atomically; concurrent acceptance must not double-book.
- Payment flow will use a licensed PSP. The wallet/ledger is a product abstraction, not an assumption that RouteShare may issue regulated e-money.

## Repository
- `apps/api`: NestJS backend
- `apps/mobile`: Expo / React Native app
- `packages/shared`: shared TypeScript domain contracts
- `docs`: product, architecture, domain and API decisions

## Baseline stack
TypeScript, pnpm workspaces, NestJS, PostgreSQL + PostGIS, Expo, WebSockets, routing and PSP adapters.

## Development status
Initial architecture and workspace scaffold. Next: database schema, authentication, route preview, trip requests, matching and atomic booking.

## Engineering rules
1. Never commit secrets; use `.env.example`.
2. Store money as integer minor units (kopecks), never floating point.
3. Store distances in metres and durations in seconds.
4. Use transactions and idempotency for booking and financial operations.
5. Document material decisions in `docs/decisions`.
