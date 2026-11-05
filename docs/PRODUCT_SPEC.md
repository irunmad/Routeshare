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

## 7. Live request map and passenger discovery

- Every passenger request in `searching` is represented on the live map by a thin road-route polyline from its origin to destination.
- Drivers can inspect active searching requests on the map. Once a driver confirms a proposed combination, its requests leave the searching pool immediately; the map may animate the affected lines (brief blink/fade) during the provisional confirmation window, then remove them.
- Passengers can browse other active searching requests in a list alongside the map. Two independent filters sit above the list: maximum road-network distance from the passenger's own origin to another request's origin, and maximum road-network distance from the passenger's own destination to another request's destination. The filters are asymmetric and independently configurable.
- These are road-network distances, not straight-line radii. Use the routing provider for accurate road distances; PostGIS may perform a broad spatial pre-filter but must not decide final inclusion by straight-line distance.
- Discovery visibility does not itself reserve, join, or expose personal contact details for another request.

## 8. Driver matching modes and offer ranking

Drivers have two matching modes:

1. **Flexible / no fixed destination.** The driver sets a pickup-search road-distance limit. The matcher proposes profitable combinations of currently searching passengers, with ordered pickups followed by feasible drop-offs, subject to capacity, time and detour constraints. A small secondary indicator may show the road distance travelled to reach the third pickup (or the last pickup when fewer than three are included); this is informational only.
2. **Destination-oriented.** The driver sets a current/starting point, a destination and a pickup-search limit. A separate destination tolerance controls how far the farthest passenger drop-off may be from the driver's chosen destination, measured by road distance. The exact tolerance and whether it applies to every drop-off or the farthest drop-off are configurable product rules; initial interpretation is the farthest drop-off must be within the configured road distance of the driver's destination.

For every proposed combination show:
- total passenger revenue (sum of each passenger's own fare);
- total actual vehicle kilometres for the complete ordered route, including reaching each pickup and all drop-offs;
- revenue per actual vehicle kilometre (total passenger revenue / complete vehicle distance);
- ordered stops and per-passenger fare breakdown.

Rank combinations primarily by revenue per actual vehicle kilometre, with feasibility, seat capacity, pickup/drop-off order, time windows and configurable detour constraints as hard constraints. Never rank using only the short distance to the third pickup: that distance is a secondary informational metric, not the profitability denominator.

## 9. Confirmation and cancellation window

- Before a driver accepts, the passenger request remains `searching`; the passenger sees **Searching for a driver** and can cancel without a fee.
- When a driver confirms a combination, the server atomically creates a provisional matched/booking state and starts a **10-second free-cancellation window** for each affected passenger.
- At confirmation, notify passengers through push notification and an in-app audible alert (subject to device notification/sound permissions). Show a cancel button with a server-authoritative countdown.
- A passenger may cancel their own booking without a fee until the server-side deadline. Client clocks are display-only; the API/database timestamp is authoritative.
- At deadline, the booking becomes fully confirmed and the free-cancellation right expires. Later cancellation follows the published stage-based policy.
- If a passenger cancels during the window, release that passenger's reservation and recalculate the remaining stop sequence and offer. If the remaining combination is no longer feasible, cancel/release the affected provisional combination atomically.
- If the driver withdraws the provisional confirmation during the window, affected passengers return to searching (or receive a clear cancellation state) and no passenger cancellation fee applies.
- Push delivery is best-effort; the in-app state must remain correct if push is delayed or unavailable. Realtime API events update map/list state and countdown.
- All transitions, timer deadlines, refunds/releases and race conditions are enforced transactionally on the server, never by trusting mobile UI state.

