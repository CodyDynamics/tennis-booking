# Database schema (ERD) — **target design**

This document describes a **proposed** PostgreSQL schema for the Booking Tennis product: multi-tenant **organization → branch → location → court**, **public vs private locations** with **memberships**, a **wizard-style court booking flow** (sport → indoor/outdoor → single date → time window → duration → court dropdown), and guidance for **high concurrency** (many users on the same day).

> **Note:** The API `apps/api/src/**/entities` now includes the **15 core tables** below (plus optional patterns in §4.3). Use **migrations** in production when `DB_SYNC=false`.

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

**Do not** render a flat grid of all courts as the primary path. Use a **stepped flow**:

1. **Sport** — dropdown: `tennis` | `pickleball` (aligned with `sports.code` / `courts.sport`).
2. **Court type** — `indoor` | `outdoor` (aligned with `courts.type`).
3. **Date** — **single-day** date picker only (no “from–to” range).
4. On date select → call API to load **time windows** and **allowed durations** for that **location + sport + type** (from `location_booking_windows` + policy).
5. User picks a **time window** (block), then **duration** (`30` | `60` | `90` minutes, or as configured).
6. System computes **available slots** inside the window for the chosen duration (see §3).
7. Second API call (or same response) returns a **dropdown of courts** that still have **at least one free slot** matching the selection for that **calendar date**.
8. User picks court + concrete slot → **confirm booking** (see §4 concurrency).

---

## 2. Summary counts (target)

| Metric | Count | Notes |
|--------|------:|-------|
| **Core domain + auth tables** | **15** | 12 legacy-equivalent + 3 new (`location_booking_windows`, `user_location_memberships`, `membership_transactions`). |
| **Optional operational tables** | **0–2** | e.g. `booking_commands` for idempotency with async workers (§4.3). |

Relationship counts evolve with new FKs; the important part is **clear ownership**: location owns booking-window config; user–location membership owns billing history.

---

## 3. Availability algorithm (slots & court dropdown)

**Inputs:** `locationId`, `sport`, `courtType` (`indoor`|`outdoor`), `bookingDate`, optional `windowId`, `durationMinutes`.

**Steps:**

1. **Load candidate courts**  
   `SELECT` from `courts` where `locationId = ?`, `sport = ?`, `type = ?`, `status = 'active'`.

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
| What should admin use? | New or extended **admin** endpoints, e.g. `GET /admin/bookings` with filters (`userId`, `locationId`, `dateFrom`, `dateTo`, `status`) and **RBAC** (e.g. `super_admin`, `location_admin`). Optionally a **read model** view joining user + court + location for support screens. |
| When **would** you add `orders`? | If you need **one checkout** with **multiple lines** (court + merch + coach) and a **single payment intent**, or unified **order status** across line types. Then `orders` + `order_lines` referencing `court_bookings` / other line types. |

---

## 7. Tables — target list

| # | Table | Purpose |
|---|--------|---------|
| 1 | `organizations` | Tenant |
| 2 | `branches` | Branch under org |
| 3 | `locations` | Facility; **public/private**, timezone, **membership pricing** |
| 4 | `location_booking_windows` | Configurable **time blocks** per location (and sport / court type) |
| 5 | `courts` | Bookable court; sport, type, pricing |
| 6 | `sports` | Catalog |
| 7 | `roles` | RBAC |
| 8 | `users` | **phone required**, **home address optional** |
| 9 | `user_location_memberships` | User’s membership at a **private** location |
| 10 | `membership_transactions` | **Money history** (initiation, monthly, adjustments) |
| 11 | `coaches` | Coach profile |
| 12 | `court_bookings` | Booking record + **pricing tier** / discount audit |
| 13 | `coach_sessions` | Coach sessions |
| 14 | `password_reset_tokens` | Auth |
| 15 | `refresh_tokens` | Auth |
| *opt* | `booking_commands` | Async booking + idempotency (§4.3) |

---

## 8. Table columns (target reference)

### `organizations`

Unchanged from legacy: `id`, `name`, `description`, `status`, `createdAt`, `updatedAt`.

### `branches`

Unchanged conceptually: `id`, `organizationId`, `name`, `address`, `phone`, timestamps.

### `locations` (extended)

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | uuid | No | PK |
| `branchId` | uuid | No | FK → `branches` |
| `name`, `address` | varchar/text | | |
| `latitude`, `longitude` | decimal | Yes | Map |
| `mapMarkers` | text | Yes | JSON |
| `timezone` | varchar | No | IANA, e.g. `America/Chicago` — **required** for slot math |
| **`visibility`** | varchar | No | **`public`** \| **`private`** |
| **`membershipInitiationFeeCents`** | int | No | Default `0`; for **private** locations, > 0 |
| **`membershipMonthlyFeeCents`** | int | No | Default `0`; maintenance fee |
| **`memberCourtDiscountPercent`** | int | No | `0–100`; discount off **public** court rate for **active** members (or use basis below) |
| **`memberCourtPriceBasis`** | varchar | No | e.g. `discount_from_public` \| `fixed_member_rate` — extensibility |
| `status` | varchar | No | `active` \| `inactive` |
| timestamps | | | |

**Public locations:** `visibility = public`; fee columns may be `0` and ignored.

**Private locations:** enforce **active membership** before allowing `court_bookings` at courts under this location.

### `location_booking_windows` (new)

Defines blocks like **08:00–10:30**, **14:00–15:30** (see UI ref). Can vary by location and filters.

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | uuid | No | PK |
| `locationId` | uuid | No | FK → `locations` |
| `sport` | varchar | No | `tennis` \| `pickleball` |
| `courtType` | varchar | No | `indoor` \| `outdoor` |
| `windowStartTime` | time | No | Local wall time |
| `windowEndTime` | time | No | Must be > start |
| `allowedDurationMinutes` | varchar/text | No | JSON array e.g. `[30,60,90]` or join table if you prefer |
| `slotGridMinutes` | int | No | e.g. `30` — step for generating slots inside window |
| `sortOrder` | int | No | Display order |
| `isActive` | boolean | No | default `true` |
| timestamps | | | |

### `courts` (extended)

| Column | Type | Notes |
|--------|------|--------|
| `id`, `locationId`, `name`, `type`, `sport` | | As today |
| **`pricePerHourPublic`** | decimal(12,2) | Rename from `pricePerHour` for clarity — **non-member** / public rate |
| **`pricePerHourMember`** | decimal(12,2) | Nullable; if set, **overrides** percent discount for this court; else use `locations.memberCourtDiscountPercent` |
| `description`, `imageUrl`, `imageGallery`, `mapEmbedUrl`, `status` | | As today |
| timestamps | | |

*Alternative:* keep a single `pricePerHour` + only location-level discount — less flexible but simpler.

### `sports`, `roles`

Unchanged.

### `users` (extended)

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id`, `organizationId`, `branchId`, `roleId`, `email`, `passwordHash`, `fullName`, `avatarUrl`, `status`, `googleId`, `courtId`, `visibility` | | As today (names may vary) |
| **`phone`** or **`phoneNumber`** | varchar | **No** | **Required**; validate format in app |
| **`homeAddress`** | text | Yes | Optional residential address |
| timestamps | | |

Migration note: backfill `phone` for existing rows before setting `NOT NULL`.

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

### `court_bookings` (extended)

Keep existing columns; add / clarify:

| Column | Type | Notes |
|--------|------|--------|
| `locationId` | uuid | Yes | Denormalized FK for admin filters + pricing rules |
| `sport`, `courtType` | varchar | Yes | Snapshot at booking time |
| `locationBookingWindowId` | uuid | Yes | Which window config was used |
| **`pricingTier`** | varchar | `public` \| `member` |
| **`unitPricePerHourSnapshot`** | decimal | Rate used before discount |
| **`discountAmount`** | decimal | Yes | If member / promo |
| **`totalPrice`** | decimal | Final |
| `userLocationMembershipId` | uuid | Yes | FK when `pricingTier = member` |
| *(optional)* `bookingStartAt`, `bookingEndAt` | timestamptz | For exclusion constraints in UTC |

Booking flow must **re-validate** membership and price **inside the transaction** that inserts the row.

### `coach_sessions`

Add `locationId` if needed for admin reporting; otherwise unchanged conceptually.

### `password_reset_tokens`, `refresh_tokens`

Unchanged.

### `booking_commands` (optional)

See §4.3.

---

## 9. High-level ERD (text)

```
organizations
     └── branches
              └── locations ──┬── location_booking_windows
                              │
                              └── courts
                                     ↑
user_location_memberships ── membership_transactions
         │
users ───┴── court_bookings (→ courts, users, optional membership)
              coach_sessions
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
