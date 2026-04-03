# Database schema (ERD) — **implementation + design notes**

This document tracks the **live** PostgreSQL schema exposed by TypeORM entities under `apps/api/src/**/entities`, plus product rules and **target / future** ideas (concurrency, RabbitMQ, exclusion constraints). The booking product centers on **locations** (optional **parent/child** hierarchy via `parentLocationId` / `kind`), **areas** under a location, **multi-sport courts** (`courts.sports[]`, `courts.courtTypes[]`), **public vs private locations** with **memberships**, and a **slot-first court booking flow** at `/locations/:id/courts` (see §1.4). Legacy **`organizations`** / **`branches`** tables may still exist in the database for older migrations but are **not required** for the current app flows described here.

> **Note:** There are **17** domain + auth tables in the repo today (§7). Use **migrations** in production when `DB_SYNC=false`. Older references to “15 tables” are superseded.

**Column names** are shown in **camelCase** (TypeORM-friendly). You may adopt a `snake_case` naming strategy in Postgres if preferred.

---

## 1. Business rules (summary)

### 1.1 Locations: `public` vs `private`

| Kind | Who can book | Membership |
|------|----------------|------------|
| **Public** | Any authenticated user (subject to your auth rules) | Not required |
| **Private** | Only users with an **active** membership **at that location** | One-time **initiation fee** (large) + recurring **monthly fee** to stay active |

Members at a **private** location receive **court booking discounts** (configurable per location; see `locations` and `court_bookings` pricing fields).

### 1.2 User profile

- **Phone number:** required (E.164 or local format + country — store consistently).
- **Home address:** optional (free-text or future structured address table).

### 1.3 Booking UI flow (location courts page)

**Do not** render a flat grid of all courts as the primary path. The **implemented** UI uses a compact **single-page** flow (see §1.4). A **stepped** alternative (dropdowns, explicit court pick) remains a valid product pattern using the same APIs.

### 1.4 Implemented flow: slot grid + auto court (location courts page)

The **live** customer UI at `/locations/:locationId/courts` uses a **slot-first** variant:

1. **Activity** — horizontal **pills** for each sport available at the venue (order e.g. Tennis → Pickleball → Ball machine), aligned with `courts.sports[]` (and `sports` catalog).
2. **Indoor / outdoor** — **pills** aligned with `courts.courtTypes[]` (booking rows store `courtType` snapshot).
3. **Duration** — pills (`30` / `60` / `90` minutes) matching policy.
4. **Date** — single-day picker; “today” and cutoffs use `locations.timezone` (IANA).
5. **Slots** — `GET /bookings/court/wizard/slots` returns aggregated intervals with `availableCount` / `totalCount` across all matching courts (no per-court names in the grid).
6. **Soft holds** — WebSocket room per location; clients signal holds on an interval so capacity updates for overlapping durations.
7. **Book** — `POST /bookings/court/slot` picks a **random free court** for that interval; `court_bookings` rows store denormalized `locationId`, `sport`, `courtType` for lists and analytics.
8. **Reschedule (same row)** — `PATCH /bookings/court/slot/:bookingId` with the same body shape as (7) updates that booking’s time/court/pricing; only `COURT_ONLY` without coach. Slot grid can pass `excludeBookingId` on `GET /bookings/court/wizard/slots` so the user’s current booking does not count as “busy” while choosing a new slot.

**Layout:** full-width page with **booking controls on the left** and a **“Hi {name}, your bookings”** sidebar on the right. Data comes from `GET /bookings/my` (scoped to the user), filtered client-side by `locationId`. **Cancel** uses `DELETE /bookings/court/:id`. **Change time** pre-fills the left form and switches the primary action to **Update now**, calling **PATCH** so no second row is inserted. **Success** is shown with a **toast** (no redirect to booking history).

### 1.5 Admin analytics dashboard (read model)

The **admin home** at `/admin` shows **operations analytics** (KPI cards + charts). Data sources:

| Mode | Source |
|------|--------|
| **Real** | `GET /admin/dashboard/metrics` (JWT + role `admin` \| `super_admin`). Aggregates from `users`, `courts`, `locations`, `court_bookings`, `coach_sessions`, `coaches`. |
| **Mockup** | Static JSON in the frontend for demos / design reviews when DB is empty or offline. |

**Metrics semantics (aligned with code in `AdminService`):**

| Series | Window / filter |
|--------|------------------|
| `dailyCourtBookings` | Rolling **14 calendar days** on `court_bookings.bookingDate` (inclusive from “today − 13” through today, using the same UTC date string as the query), **`bookingStatus` ≠ `cancelled`**. |
| `dailyRevenue` | Same date window; per-day **sum** of `court_bookings.totalPrice`. |
| `totals.revenue14d` | Sum of `dailyRevenue` over that window. |
| `bookingsBySport` | **Same 14-day window** and non-cancelled filter as the daily charts; grouped by `COALESCE(court_bookings.sport, 'unknown')`. |
| KPI “Open court bookings” | Count of rows with `bookingStatus` ∈ {`pending`, `confirmed`} (not tied to the 14-day window). |
| KPI “Coach sessions (scheduled)” | `coach_sessions` with `status = scheduled`. |

**Drill-down (UI):** clicking a bar in **By sport** opens a right-hand panel. **Real** data: `GET /admin/dashboard/metrics/by-sport?sport=<key>` returns counts for that sport in the **same 14-day window**, grouped by **booker role name** (`users` → `roles`), **`court_bookings.bookingType`** (`COURT_ONLY` \| `COURT_COACH`), and **`users.accountType`** (`normal` \| `membership` \| `system`). Use `sport=unknown` for the “Other” bucket (null/empty `sport` on rows).

**Further drill-down (lists):**

| Endpoint | Purpose |
|----------|---------|
| `GET /admin/dashboard/metrics/by-sport/drilldown?sport=&dimension=&value=&page=&pageSize=` | **Distinct bookers** in that 14-day sport slice with **per-user booking counts**, filtered by `dimension` = `role` \| `bookingType` \| `accountType` and the matching `value` (role label / enum / account type). Paginated. |
| `GET /admin/dashboard/metrics/kpi-drilldown?metric=&page=&pageSize=` | Rows behind a **KPI tile** (`usersActive`, `courts`, `locations`, `courtBookingsOpen`, `coachSessionsScheduled`, `coaches`, `revenue14d`). Paginated. |
| `GET /admin/dashboard/metrics/day-bookings?date=YYYY-MM-DD&page=&pageSize=` | **Non-cancelled** `court_bookings` on one **calendar day** (for chart point clicks). Paginated. |

These routes are **read-only** and reuse existing tables (`users`, `courts`, `locations`, `court_bookings`, `coach_sessions`, `coaches`, `roles`). Admin booking management remains `GET /admin/bookings` (see admin app).

---

## 2. Summary counts (target)

| Metric | Count | Notes |
|--------|------:|-------|
| **Core domain + auth tables (implemented)** | **17** | Includes `areas`, `location_booking_windows`, `user_location_memberships`, `membership_transactions`, `booking_commands`, etc. (see §7). |
| **Optional / future patterns** | — | e.g. heavier use of `booking_commands` with async workers (§4.3); exclusion constraints on `court_bookings` (§4.1). |

Relationship counts evolve with new FKs; the important part is **clear ownership**: location owns booking-window config; user–location membership owns billing history.

---

## 3. Availability algorithm (slots & court dropdown)

**Inputs:** `locationId`, `sport`, `courtType` (`indoor`|`outdoor`), `bookingDate`, optional `windowId`, `durationMinutes`.

**Steps:**

1. **Load candidate courts**  
   `SELECT` from `courts` where `locationId = ?`, `status = 'active'`, and the chosen **sport** is contained in `courts.sports` (text[]) and **court type** (indoor/outdoor) is contained in `courts.courtTypes` (text[]).

2. **Load time window**  
   From `location_booking_windows` for that location (and matching `sport` / `courtType` if columns are scoped). Window defines `[windowStartTime, windowEndTime]` on the chosen **calendar day** (local timezone of the location — store `locations.timezone`).

3. **Generate candidate slot starts**  
   Step from `windowStart` by a **slot grid** (e.g. 15 or 30 minutes) up to `windowEnd - duration`. For each start `S`, slot is `[S, S + duration)`.

4. **Subtract existing bookings**  
   For each court, load `court_bookings` for `bookingDate` with `bookingStatus` not in (`cancelled`) and overlapping time ranges. A slot is **free** if it does not intersect any booking.

5. **Build API response**  
   - List of **windows** + **durations** allowed.  
   - For selected window + duration: list **concrete slots** (start–end).  
   - **Court dropdown:** courts that have **≥ 1** free slot for the user’s current selection.

**Performance:** index `(courtId, bookingDate)` on `court_bookings`; consider `(locationId, bookingDate)` if denormalized. Cache **read-only** availability for a few seconds if needed; **never** trust cache for the final commit (§4).

**Timezone:** store `bookingDate` as `date` in **location local** semantics; normalize “now” and comparisons using `locations.timezone` (IANA string).

---

## 4. Concurrency: many users, same day — RabbitMQ & “who wins”

**Problem:** 2–100 users may pick the same date/window/duration/court/slot. Only **one** booking should succeed per overlapping interval on a **given court**.

### 4.1 Source of truth (recommended)

Use the **database** as the authority:

- **Unique constraint** preventing double booking for the same court and overlapping time is ideal. Postgres supports **exclusion constraints** on a `tstzrange` (store `bookingStartAt` / `bookingEndAt` in UTC), e.g. `EXCLUDE USING gist (courtId WITH =, tstzrange(bookingStartAt, bookingEndAt) WITH &&)` with appropriate constraints.  
- Alternatively, a **unique** constraint on `(courtId, bookingDate, startTime)` if you **disallow** duplicate start times and snap all bookings to a fixed grid.

On insert: **one transaction wins**, others get a **unique violation** → API returns **409 Conflict** / friendly “Slot just taken”.

### 4.2 Where RabbitMQ fits

RabbitMQ does **not** replace the DB constraint. Use it for:

1. **Ordered processing (optional):** A **single-consumer** queue **per shard** (e.g. per `courtId` + `bookingDate` routing key) so attempts are processed **sequentially** — reduces contention and gives predictable “first message wins” semantics at the application layer. Still keep the **DB unique/exclusion** constraint.
2. **Peak load:** HTTP handler **acknowledges quickly** by enqueueing a `BookingCommand` (id + user + slot); worker performs `INSERT` and emits **success/failure** events (WebSocket / SSE / polling).
3. **Side effects:** payment, email, analytics — **after** a successful commit.

**“Who clicked first by millisecond”:** pure wall-clock order across many app servers is **not** reliable without a **single sequencer** (queue) or **DB commit order**. Practical approach: **client `requestedAt`** + server **queue order** + **first successful commit** wins; others get a clear error.

### 4.3 Optional table: `booking_commands` (idempotency)

If you use async workers:

| Column | Purpose |
|--------|---------|
| `id` (uuid) | PK |
| `idempotencyKey` | Unique per user+slot attempt (client-generated or server) |
| `userId`, `courtId`, `bookingDate`, `startTime`, `endTime` | Payload |
| `status` | `pending` \| `succeeded` \| `failed` |
| `failureReason` | Nullable |
| `createdAt`, `processedAt` | Audit |

Worker: `INSERT ... ON CONFLICT DO NOTHING` into `court_bookings`; update command row. RabbitMQ message carries `commandId`.

---

## 5. Membership & money history

**Yes — add a ledger table.** You need:

- Auditable **initiation** and **monthly** charges (and later: refunds, comps, promotions).
- To know **why** a user had member pricing on a given booking (link optional FK from `court_bookings` to `user_location_memberships`).

Suggested:

- **`user_location_memberships`** — current state (active / lapsed / pending).
- **`membership_transactions`** — **append-only** financial history (amount, type, period covered, external payment id).

Future perks (guest passes, pro shop discount codes) can hang off `user_location_memberships` or a separate `membership_benefits` table without rewriting bookings.

---

## 6. Admin: “orders” vs `bookings/my`

| Question | Answer |
|----------|--------|
| Is `GET .../bookings/my` enough for admin? | **No** for admin use cases. That route is scoped to the **authenticated user** (“my”). |
| Do you need a separate **`orders` table?** | **Not required** for court-only products. Each **`court_bookings`** row **is** an order line / booking record. **`coach_sessions`** is analogous for coach products. |
| What should admin use? | **Implemented:** `GET /admin/dashboard/metrics` for dashboard KPIs/charts (see §1.5). **Future:** `GET /admin/bookings` with filters (`userId`, `locationId`, `dateFrom`, `dateTo`, `status`) and **RBAC** (e.g. `super_admin`, `location_admin`). Optionally a **read model** view joining user + court + location for support screens. |
| When **would** you add `orders`? | If you need **one checkout** with **multiple lines** (court + merch + coach) and a **single payment intent**, or unified **order status** across line types. Then `orders` + `order_lines` referencing `court_bookings` / other line types. |

---

## 7. Tables — implemented list (TypeORM)

| # | Table | Purpose |
|---|--------|---------|
| 1 | `organizations` | Optional / legacy tenant (entity may exist; not required for current location-first flows) |
| 2 | `branches` | Optional / legacy (entity may exist) |
| 3 | `locations` | Facility; **`parentLocationId`**, **`kind`** (root vs child venue), **public/private**, timezone, **membership pricing** |
| 4 | `areas` | Sub-venue under a location (visibility, status); courts may reference `areaId` |
| 5 | `location_booking_windows` | Per-**court** (and/or location) **time blocks** — sport, court type, window times, slot policy |
| 6 | `courts` | Bookable court; `locationId`, optional `areaId`, **`sports[]`**, **`courtTypes[]`**, public/member hourly rates, media fields |
| 7 | `sports` | Catalog |
| 8 | `roles` | RBAC; `name`, `permissions` string |
| 9 | `users` | Accounts: **email** (unique), **phone**, `roleId`, `accountType`, `mustChangePasswordOnFirstLogin`, optional `courtId`, `visibility`, OAuth fields — **no `organizationId` / `branchId`** on user in current entity |
| 10 | `user_location_memberships` | User’s membership at a location (venue scope) |
| 11 | `membership_transactions` | **Money history** (initiation, monthly, adjustments) |
| 12 | `coaches` | Coach profile (`userId`, rates, bio) |
| 13 | `court_bookings` | Court booking: user, court, location snapshot, **sport** / **courtType** snapshots, pricing, **bookingType**, **paymentStatus**, **bookingStatus**, UTC interval fields, reminder email timestamp |
| 14 | `coach_sessions` | Coach sessions |
| 15 | `password_reset_tokens` | Auth |
| 16 | `refresh_tokens` | Auth |
| 17 | `booking_commands` | Idempotency / command ledger for booking flows (see entity) |

---

## 8. Table columns (target reference)

### `organizations` / `branches`

Legacy / optional. See entity files if still present in your database.

### `locations` (current)

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | uuid | No | PK |
| **`parentLocationId`** | uuid | Yes | **Root vs child** venue tree |
| **`kind`** | varchar | No | e.g. `root` \| `child` |
| `name`, `address` | varchar/text | | |
| `latitude`, `longitude` | decimal | Yes | Map |
| `mapMarkers` | text | Yes | JSON |
| `timezone` | varchar | No | IANA — **required** for slot math |
| **`visibility`** | varchar | No | **`public`** \| **`private`** |
| **`membershipInitiationFeeCents`** | int | No | Default `0` |
| **`membershipMonthlyFeeCents`** | int | No | Default `0` |
| **`memberCourtDiscountPercent`** | int | No | `0–100` |
| **`memberCourtPriceBasis`** | varchar | No | e.g. `discount_from_public` |
| `status` | varchar | No | `active` \| `inactive` |
| timestamps | | | |

### `location_booking_windows`

Per **location**, optionally scoped to a **court** (`courtId` null = location-level window for that sport + court type). Defines bookable wall-clock windows and slot policy.

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | uuid | No | PK |
| `courtId` | uuid | Yes | FK → `courts`; **null** = applies at location level |
| `locationId` | uuid | No | FK → `locations` |
| `sport` | varchar | No | e.g. `tennis`, `pickleball`, `ball-machine` |
| `courtType` | varchar | No | `indoor` \| `outdoor` |
| `windowStartTime` | time | No | Local wall time |
| `windowEndTime` | time | No | Must be > start |
| `allowedDurationMinutes` | varchar/text | No | JSON e.g. `[30,60,90]` |
| `slotGridMinutes` | int | No | e.g. `30` |
| `sortOrder` | int | No | Display order |
| `isActive` | boolean | No | default `true` |
| timestamps | | | |

### `areas` (implemented)

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `locationId` | uuid | FK → `locations` |
| `name`, `description` | varchar/text | |
| `status` | varchar | e.g. `active` |
| `visibility` | varchar | aligned with location visibility enum |
| timestamps | | |

### `courts` (implemented)

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `locationId` | varchar/uuid | FK → `locations` |
| `areaId` | uuid | Optional FK → `areas` |
| `name` | varchar | |
| **`courtTypes`** | text[] | `indoor` / `outdoor` tags (may include both) |
| **`sports`** | text[] | Activities bookable on this physical court |
| `pricePerHourPublic`, `pricePerHourMember` | decimal(12,2) | Member rate optional |
| `description`, `imageUrl`, `imageGallery`, `mapEmbedUrl`, `status` | | |
| timestamps | | |

### `sports`, `roles`

Unchanged.

### `users` (implemented)

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | uuid | No | PK |
| `roleId` | uuid | Yes | FK → `roles` |
| `email` | varchar | No | **Globally unique** (per current entity) |
| `passwordHash` | varchar | Yes | Null for OAuth-only until set |
| `fullName`, `firstName`, `lastName` | varchar | | |
| `phone` | varchar | No | Required for registered users; OAuth may use placeholder until profile completion |
| `homeAddress` | text | Yes | |
| `avatarUrl` | varchar | Yes | |
| `status` | varchar | No | e.g. `active` |
| `mustChangePasswordOnFirstLogin` | boolean | No | Default `false` |
| `googleId` | varchar | Yes | |
| `courtId` | uuid | Yes | Staff/coach primary court |
| `visibility` | varchar | No | `public` \| `private` (directory / coaches listing) |
| **`accountType`** | varchar | No | `normal` \| `membership` \| `system` — provisioning / registration path (see enum in code) |
| timestamps | | |

### `user_location_memberships` (new)

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `userId` | uuid | FK → `users` |
| `locationId` | uuid | FK → `locations` |
| `status` | varchar | `pending_payment` \| `active` \| `grace` \| `lapsed` \| `cancelled` |
| `initiationPaidAt` | timestamptz | Yes until paid |
| `currentPeriodStart`, `currentPeriodEnd` | date or timestamptz | Monthly cycle |
| `lastMonthlyPaidAt` | timestamptz | Yes |
| `cancelledAt` | timestamptz | Yes |
| timestamps | | |

Unique: `(userId, locationId)` for one active membership row per pair (or use partial unique index on `active`).

### `membership_transactions` (new) — **money history**

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `userLocationMembershipId` | uuid | FK → `user_location_memberships` |
| `type` | varchar | `initiation` \| `monthly` \| `refund` \| `adjustment` \| `promo` |
| `amountCents` | int | Signed if refunds |
| `currency` | varchar | e.g. `USD` |
| `periodLabel` | varchar | Yes | e.g. `2026-03` for monthly |
| `externalPaymentId` | varchar | Yes | Stripe payment intent / invoice id |
| `metadata` | jsonb | Yes | Extensibility |
| `createdAt` | timestamptz | No | Append-only |

### `court_bookings` (implemented)

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `locationId` | uuid | Denormalized FK for filters, pricing, analytics |
| `sport`, `courtType` | varchar | Snapshot at booking time (admin “By sport” uses `sport`) |
| `locationBookingWindowId` | uuid | Window config used |
| `pricingTier` | varchar | `public` \| `member` |
| `unitPricePerHourSnapshot`, `discountAmount`, `totalPrice` | decimal | Pricing audit |
| `userLocationMembershipId` | uuid | When member pricing applies |
| `bookingStartAt`, `bookingEndAt` | timestamptz | UTC interval (slot conflict / APIs) |
| `courtId`, `userId` | uuid | Required FKs |
| `coachId` | varchar | Optional |
| **`bookingType`** | varchar | `COURT_ONLY` \| `COURT_COACH` |
| `bookingDate` | date | Calendar date (location-local semantics in app) |
| `startTime`, `endTime` | time | |
| `durationMinutes` | int | |
| **`paymentStatus`** | varchar | `unpaid` \| `paid` \| `refunded` |
| **`bookingStatus`** | varchar | `pending` \| `confirmed` \| `cancelled` \| `completed` |
| `reminder30EmailSentAt` | timestamptz | Optional; 30-minute reminder tracking |
| timestamps | | |

Booking flow must **re-validate** membership and price **inside the transaction** that inserts the row. **Recommended future:** DB exclusion constraint on `(courtId, tstzrange(bookingStartAt, bookingEndAt))` (§4.1).

### `coach_sessions`

Add `locationId` if needed for admin reporting; otherwise unchanged conceptually.

### `password_reset_tokens`, `refresh_tokens`

Unchanged.

### `booking_commands` (optional)

See §4.3.

---

## 9. High-level ERD (text)

```
locations (self-reference: parentLocationId / kind)
     ├── areas
     └── courts (→ optional area; sports[], courtTypes[])
              └── location_booking_windows (per court + location)

user_location_memberships ── membership_transactions
         │
users ───┴── court_bookings (→ courts, users, optional membership, optional coach)
              coach_sessions (→ coach, optional court)
roles ←──── users.roleId
coaches (userId → users)

Optional legacy: organizations, branches (if still in DB)
```

---

## 10. Implementation notes

- **Migrations:** Add new tables and columns with backward-compatible defaults; then backfill; then enforce `NOT NULL` on `users.phone`.
- **API surface:**  
  - `GET /locations/:id/booking-options?date=&sport=&courtType=` → windows, durations, slots (read-only).  
  - `GET /locations/:id/available-courts?...` → court dropdown.  
  - `POST /court-bookings` or async `POST /court-bookings:request` + worker — your choice; DB constraint is mandatory.
- **RabbitMQ:** `libs/messaging` can host publishers/consumers for `BookingCommand` and payment webhooks.

---

## 11. Legacy reference

The previous **12-entity** inventory (without membership, without booking windows, with nullable `users.phone`) is superseded by this document. When implementing, diff entity files against §7–§8 and generate TypeORM migrations accordingly.
