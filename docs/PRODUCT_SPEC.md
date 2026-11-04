# Product specification — initial baseline

## 1. Roles

A single account may act as a passenger, a driver, or both. Role selection changes the primary workflow, not the identity/account.

## 2. Passenger journey

1. Choose origin and destination on the map or via place search.
2. Review the route distance and estimated fare.
3. Set an offered rate in UAH/km. Raising the rate affects only this passenger's offer.
4. Submit the request only when the available spendable balance covers its maximum payable amount.
5. Receive a booking confirmation when a driver accepts a compatible trip/combination.
6. See pickup, driver and trip status; receive receipts and cancellation outcomes.

Passenger fare baseline:
`fare = passenger_route_distance_km × passenger_offered_rate_uah_per_km`.
The implementation must define rounding and whether the route distance is rounded before multiplication; default recommendation is calculate using metres and integer kopecks, then round once at the final amount.

## 3. Driver journey

1. Publish a route, departure window, available seats and optional constraints.
2. View compatible passenger requests and suggested combinations.
3. Each suggestion shows the ordered stop sequence, passenger fares, total driver revenue, vehicle distance including all detours, extra distance versus the driver's direct route, gross revenue per vehicle kilometre, platform fee and estimated driver net.
4. Accept a combination in one atomic operation.
5. Navigate the ordered stops and update trip status.

## 4. Matching constraints

A candidate combination must respect:
- vehicle seat capacity at every segment, not just total passenger count;
- pickup-before-drop-off for every passenger;
- route compatibility and maximum detour;
- departure and arrival time windows;
- passenger and driver cancellation/status rules;
- no duplicate active booking for a passenger request;
- driver route and vehicle constraints.

The matching engine must optimize a configurable objective. Initial objective: maximize driver net revenue while limiting added vehicle distance and passenger detour. Do not silently optimize only for the number of passengers.

## 5. Money and settlement

- One token is presented to the user as one hryvnia, but internal amounts are integer UAH minor units (kopecks).
- Maintain an immutable ledger; do not treat a mutable balance column as the financial source of truth.
- Distinguish available, reserved, pending settlement and withdrawable funds.
- On acceptance, reserve funds and seats atomically.
- Driver cancellation releases/refunds the passenger reservation according to the booking state.
- Passenger cancellation policy is stage-based and must be explicitly published before launch.
- Platform commission is initially modelled as 10% and must be configurable.
- PSP, custody/flow of funds, tax agency model and legal terms require professional review before real-money launch.

## 6. MVP boundaries

MVP: phone authentication, profiles, driver route publishing, passenger requests, route matching, booking, trip status, ratings/support and payment-provider sandbox.

Not in MVP until validated: complex surge pricing, subscriptions, corporate fleets, cash settlement, advanced dispatch automation and multiple routing providers.
