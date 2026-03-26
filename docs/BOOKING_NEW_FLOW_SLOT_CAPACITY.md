# Booking New Flow (Slot Capacity + Auto Court Assignment)

This document describes the new booking flow where users only choose **time slots** (not court names), and the system auto-assigns a court.

---

## 1) Product behavior

### User-facing flow

1. User opens `/locations/:id/courts`
2. User selects:
   - `Sport` (tennis/pickleball)
   - `Indoor/Outdoor`
   - `Date` (inline calendar, no dropdown)
   - `Duration` (`30 | 60 | 90` minutes)
3. UI shows available slots like `08:00 - 09:00 (2 left)` without exposing court names.
4. User selects a slot and clicks `Book now`.
5. Backend picks a random available court for that slot and creates booking.

### Important rules

- Court identity is hidden from users in slot table.
- Slot capacity is based on number of active courts in that location/sport/type.
- Holds are soft-locks and expire automatically (TTL).
- Final truth is still DB booking write path.

---

## 2) Backend APIs

### `GET /bookings/court/wizard/slots` (JWT)

Query:

- `locationId`
- `sport`
- `courtType`
- `bookingDate`
- `durationMinutes`

Response:

- `slots[]` where each item has:
  - `startTime`
  - `endTime`
  - `durationMinutes`
  - `availableCount` (free courts from DB snapshot)
  - `totalCount` (active courts capacity)

### `POST /bookings/court/slot` (JWT)

Body:

- `locationId`
- `sport`
- `courtType`
- `bookingDate`
- `startTime`
- `endTime`
- `durationMinutes`
- `coachId?`

Behavior:

- Backend searches candidate courts for location/sport/type.
- Randomizes candidate order.
- Picks first currently available court.
- Creates booking using normal booking constraints.
- Returns standard booking result.

---

## 3) WebSocket events (`/holds` namespace)

Room model: `location:{locationId}`

### Join / snapshots

- Client emits: `join:location`
- Server emits back immediately:
  - `slot:update` (current slot hold counts snapshot)
  - (legacy) `hold:update` for court-level flow compatibility

### Slot hold lifecycle

- Client emits: `slot:hold_request`
- Client emits: `slot:hold_release`
- Client emits after success: `slot:booked`
- Server broadcasts:
  - `slot:update` (latest holdCounts)
  - `availability:changed` (clients should refetch slots)

`holdCounts` format:

- key: `sport|courtType|date|startTime|endTime`
- value: number of active holders for that exact interval key

---

## 4) Left-count algorithm in frontend

`left` shown in UI is not just exact-key hold subtraction.

For each rendered slot interval `[S, E)`:

1. Collect all current holds in same `sport + courtType + date`.
2. Compute overlap with `[S, E)`.
3. Build sweep-line events and compute `maxConcurrentHolds` inside `[S, E)`.
4. Display:

`realAvailable = max(0, availableCount - maxConcurrentHolds)`

Why this matters:

- A `30m` hold at `08:00-08:30` must reduce visible capacity for `60m` slot `08:00-09:00`.
- Prevents cross-duration overbooking visuals.

---

## 5) Auth/401 stability

Frontend API client includes automatic one-time retry on `401`:

- If non-auth request gets `401`, client calls `/auth/refresh` using cookie.
- If refresh succeeds, original request is retried once.
- This prevents temporary “Unauthorized until F5” behavior when access token expires.

---

## 6) Current seed profile for testing

For easier testing in this flow:

- Public tennis location (`Springpark Tennis Center`)
- Courts: `Court 1`, `Court 2`, `Court 3`
- Booking window: `08:00 - 11:00`
- Durations: `30, 60, 90`

---

## 7) Known constraints and recommendations

- Soft-lock is advisory UX lock; DB write path remains source of truth.
- For higher contention, add server-side capacity guard in `slot:hold_request` so a hold is denied immediately when slot is at capacity.
- Keep exclusion/overlap constraints in DB for hard correctness.

