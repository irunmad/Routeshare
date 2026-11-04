# Data integrity and concurrency notes

## Spatial data
Origins and destinations are PostGIS geography points (SRID 4326); road routes are geography LineStrings. Spatial indexes support candidate filtering. Use a routing provider for road distance and ETA; never use straight-line distance as the passenger fare distance.

## Money
All monetary columns are integer minor units in UAH. The offered rate is also stored as minor units per kilometre. The fare is calculated from route metres and that rate, with one final rounding step. A ledger transaction is immutable and idempotent; account balance is derived from entries or a separately maintained, transactionally updated projection.

## Accepting a combination
Acceptance is a single database transaction:
1. Lock the trip offer and affected passenger requests.
2. Confirm the offer is still available and not expired.
3. Confirm every request is still searching and no active booking exists.
4. Recalculate/check vehicle seat occupancy for every segment of the ordered stop sequence.
5. Reserve passenger funds and driver seats.
6. Insert bookings, ledger entries and status events.
7. Mark the offer accepted and competing offers/requests unavailable.
8. Commit.

If any check fails, roll back the entire operation. The API must accept an idempotency key and return the original outcome on safe retries. Do not rely on a prior UI check for correctness.
