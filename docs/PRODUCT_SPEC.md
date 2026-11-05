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


## 10. Shared map/list visualization and overlapping combinations

Map and list are two synchronized views of the same live result set for both passenger and driver modes. Switching views must preserve active filters, sorting, selected route/combination and live status. A change received from the server must update both views consistently.

### Passenger map/list

- The passenger can switch between **Map** and **List**. Both show the same currently relevant data, controlled by the two independent road-distance filters defined in section 7.
- On the passenger map, show driver-published routes that are actively searching for compatible passengers as thin **black** route lines, and active passenger requests still in searching state as thin **red** route lines.
- The passenger list presents the same eligible active routes/requests with useful route and distance details. The filters apply to road-network distance between the passenger's origin and another request's origin, and between their destination points; do not replace them with straight-line radius filters.
- A request line is shown as searching only while its request is actually available. Provisional/accepted requests must not be presented as available to join or match.

### Driver map/list

- The driver can switch between **Map** and **List** without losing the current matching mode, search limits, sorting or selected combination.
- When the driver selects/sets a second point (destination) on the map, display the driver's chosen route as a distinct, visually emphasized line. In destination-oriented mode this is the target route; flexible mode does not imply a fixed destination.
- The driver list contains ranked feasible combinations. The map simultaneously highlights up to the **three highest-ranked combinations** from that same list:
  1. bright **red** — highest-ranked / most attractive combination;
  2. **green** — second;
  3. **blue** — third.
- Each highlighted combination is rendered as its own ordered vehicle route, including the pickup and drop-off sequence. The selected combination in the list and its map highlight must stay linked.
- The ranking colors are local to a particular driver's current result set. They are not permanent attributes of a passenger request and must not be stored as a request's global color.

### One passenger request can belong to multiple combinations

- Candidate combinations are driver-specific and recalculated from the current pool. The same searching passenger request may appear in several different candidate combinations for one driver, and/or in combinations proposed to different drivers. For example, request R may be part of combination A for one driver and combination B for another.
- Consequently, a passenger request may be drawn in more than one candidate route overlay and may have different rank colors in different drivers' map views. Never model a request as having one globally assigned attractiveness color.
- Keep the underlying request as one canonical entity. Candidate combinations are separate derived offers/snapshots referencing request IDs; do not duplicate the passenger request to represent each combination.
- When any driver provisionally confirms a combination, atomically claim the included requests so they are immediately excluded from every other driver's eligible matching pool. Invalidate/recompute all other candidate combinations that reference any claimed request. This must happen across all drivers, not only the accepting driver's screen.
- For the accepting driver and every other driver whose currently displayed candidate combinations included any request from the accepted combination, preserve a short-lived animation snapshot for the full 10-second free-cancellation window. **Every passenger route line belonging to the accepted combination must blink**, not just one representative line. On the accepting driver's map, all passenger route lines in the accepted combination blink in that accepted combination's rank color (for example, all three lines blink bright red if it was that driver's #1 combination).
- On each other driver's map, the same affected passenger route line(s) also blink, but retain the color of the candidate combination/rank in which they appeared in that particular driver's own result set. Thus the same passenger request can blink red for one driver, blue for another, and appear in different colors across different drivers or candidate overlays. Do not propagate the accepting driver's color globally.
- Animation is per candidate-combination/request overlay, not a global property of the passenger request. If a request appeared in more than one candidate combination in a driver's map, preserve each affected overlay's own rank color during the transition; avoid collapsing them into one global color.
- After the server-authoritative free-cancellation deadline, remove the affected provisional/invalid candidate overlays and show only the resulting current state. Other drivers must not continue to see a claimed request as an available candidate during the window. Any retained animation is visual feedback only, clearly non-interactive, and must never allow another driver to accept it.
- If one passenger cancels during the free window and the remaining offer is recalculated, update the affected route overlays and ranked list from the server's new canonical result. If the offer becomes infeasible, release/cancel the remaining provisional claims atomically and restore eligible requests to searching as appropriate.
- Colors are presentation semantics only. Matching, acceptance, locking and cancellation are based on stable request/offer IDs and server states, never on map color or client animation state.

