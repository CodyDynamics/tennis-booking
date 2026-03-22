# Court booking: availability, Postgres truth, RabbitMQ

## 1. Availability algorithm (implemented)

1. **Candidate courts** — `courts` where `locationId`, `sport`, `type` (indoor/outdoor), `status = active`.
2. **Windows** — `location_booking_windows` for the same location + sport + `courtType`, `isActive`.
3. **Grid** — For a chosen calendar `bookingDate`, window `[windowStartTime, windowEndTime]` (location wall clock) and `slotGridMinutes`, generate start times `S` such that `[S, S + durationMinutes)` ⊆ window.
4. **Subtract bookings** — For each court, load `court_bookings` with `bookingStatus ∈ {pending, confirmed}` on that date and `coach_sessions` on that court with `status = scheduled`; treat each as a busy interval. A slot is free if its half-open interval does not overlap any busy interval.

Public API:

- `GET /bookings/court/wizard/windows?locationId=&sport=&courtType=` (JWT)
- `GET /bookings/court/wizard/availability?locationId=&sport=&courtType=&bookingDate=&windowId=&durationMinutes=` (JWT)

Private locations require an **active** `user_location_membership` (same rule as booking).

**Past dates/times:** `bookingDate` is compared to “today” in `locations.timezone`; same-day slots before the current wall-clock time in that zone are omitted (wizard) or rejected (`POST /bookings/court`).

## 2. Postgres as source of truth

- **Read path** (wizard) reduces contention but is still a snapshot: another user can book before you confirm.
- **Write path** (`POST /bookings/court`) must be authoritative: we set `bookingStartAt` / `bookingEndAt` in **UTC** from `bookingDate` + `startTime`/`endTime` + `locations.timezone` (via `timestamp AT TIME ZONE` in SQL).
- **Recommended in production:** add a **partial exclusion constraint** so two overlapping active bookings cannot exist for the same court — see `scripts/sql/add-court-booking-time-exclusion.sql`. On violation, the API returns **409 Conflict** (`exclusion_violation` / `23P01`).

Do **not** rely on the client clock for ordering; use server/DB time for “who wins.”

## 3. RabbitMQ — what it’s for (and what it’s not)

**Not a substitute for constraints.** If two requests enqueue the same slot, **both** workers may run; only the first `INSERT` that commits should succeed. The second must fail on the DB and return a clear error.

**Good uses:**

1. **Ordered attempts (optional)** — e.g. one consumer per `(courtId, bookingDate)` routing key so application-level handling is sequential; still keep the DB exclusion/unique rule.
2. **Fast HTTP** — Enqueue `booking_commands`, return `202` + `commandId`; worker performs insert, emails, webhooks.
3. **Side effects after commit** — payments, notifications, analytics.

### “Who clicked first by a few milliseconds?”

Across multiple app instances there is **no** shared “click time” unless you introduce:

- a **single sequencer** (queue consumption order per shard), or  
- **database commit order** (first successful transaction wins; others get constraint errors).

So: **queue order + DB commit** (or **only DB** with synchronous `POST`) defines the winner — not the browser timestamp alone.

## 4. `booking_commands` + idempotency (optional async flow)

Table `booking_commands` (entity in codebase) supports:

- `idempotencyKey` **UNIQUE** — same retry does not create two bookings.
- `status` / `failureReason` / `resultCourtBookingId` — worker progress.

Typical worker flow:

1. `INSERT` command row `pending` (or `ON CONFLICT (idempotencyKey) DO NOTHING` and read existing).
2. Process message; `UPDATE` → `processing`.
3. Insert `court_bookings` inside a transaction; on success `succeeded` + `resultCourtBookingId`; on exclusion violation `failed` + reason.

RabbitMQ payload should carry `commandId`; **idempotent** handlers check command status before re-inserting.
