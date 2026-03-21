# Database schema (ERD overview)

This document describes the **PostgreSQL** schema used by the Booking Tennis API (NestJS + TypeORM). It reflects a small **multi-tenant ERP-style** model: **organization → branch → location → court**, plus **users/roles**, **bookings**, and **auth** tables.

**Column names** in the database follow **TypeORM property names** (camelCase); there is no global `snake_case` naming strategy in this project.

Source of truth: entity files under `backend/apps/api/src/**/entities/*.entity.ts`.

---

## Summary counts

| Metric | Count | Notes |
|--------|------:|-------|
| **Tables (entities)** | **12** | One `@Entity` = one physical table (see list below). |
| **TypeORM modeled relations** | **11** | Each row is one `@ManyToOne` + `@JoinColumn` from a child entity to a parent. |
| **Additional logical FK columns** | **9** | UUID/string columns that reference other tables but are **not** declared as TypeORM relations (application-level consistency). |

There are **no** `@OneToMany`, `@ManyToMany`, or `@OneToOne` decorators in the current codebase; inverse sides of relationships are implied only.

---

## Tables (12)

| # | Table name | Entity class | Source file |
|---|------------|--------------|-------------|
| 1 | `organizations` | `Organization` | `organizations/entities/organization.entity.ts` |
| 2 | `branches` | `Branch` | `branches/entities/branch.entity.ts` |
| 3 | `locations` | `Location` | `locations/entities/location.entity.ts` |
| 4 | `courts` | `Court` | `courts/entities/court.entity.ts` |
| 5 | `sports` | `Sport` | `sports/entities/sport.entity.ts` |
| 6 | `roles` | `Role` | `roles/entities/role.entity.ts` |
| 7 | `users` | `User` | `users/entities/user.entity.ts` |
| 8 | `coaches` | `Coach` | `coaches/entities/coach.entity.ts` |
| 9 | `court_bookings` | `CourtBooking` | `bookings/entities/court-booking.entity.ts` |
| 10 | `coach_sessions` | `CoachSession` | `bookings/entities/coach-session.entity.ts` |
| 11 | `password_reset_tokens` | `PasswordResetToken` | `auth/entities/password-reset-token.entity.ts` |
| 12 | `refresh_tokens` | `RefreshToken` | `auth/entities/refresh-token.entity.ts` |

---

## Table columns (full reference)

### `organizations`

| Column | DB type | Nullable | Default | Notes |
|--------|---------|----------|---------|--------|
| `id` | `uuid` | No | generated | Primary key |
| `name` | `varchar` | No | — | |
| `description` | `text` | Yes | — | |
| `status` | `varchar` | No | `active` | Intended: `active` \| `inactive` |
| `createdAt` | `timestamp` | No | auto | `@CreateDateColumn` |
| `updatedAt` | `timestamp` | No | auto | `@UpdateDateColumn` |

### `branches`

| Column | DB type | Nullable | Default | Notes |
|--------|---------|----------|---------|--------|
| `id` | `uuid` | No | generated | Primary key |
| `organizationId` | `varchar` | Yes | — | **Logical FK** → `organizations.id` (no `@ManyToOne`) |
| `name` | `varchar` | No | — | |
| `address` | `varchar` | Yes | — | |
| `phone` | `varchar` | Yes | — | |
| `createdAt` | `timestamp` | No | auto | |
| `updatedAt` | `timestamp` | No | auto | |

### `locations`

| Column | DB type | Nullable | Default | Notes |
|--------|---------|----------|---------|--------|
| `id` | `uuid` | No | generated | Primary key |
| `branchId` | `uuid` / `varchar` | No | — | **FK** → `branches.id` (`CASCADE` on delete) |
| `name` | `varchar` | No | — | |
| `address` | `varchar` | Yes | — | |
| `latitude` | `decimal(10,7)` | Yes | — | WGS84, stored as string in TS |
| `longitude` | `decimal(10,7)` | Yes | — | WGS84 |
| `mapMarkers` | `text` | Yes | — | JSON array: `[{ lat, lng, label }]` |
| `status` | `varchar` | No | `active` | Intended: `active` \| `inactive` |
| `createdAt` | `timestamp` | No | auto | |
| `updatedAt` | `timestamp` | No | auto | |

### `courts`

| Column | DB type | Nullable | Default | Notes |
|--------|---------|----------|---------|--------|
| `id` | `uuid` | No | generated | Primary key |
| `locationId` | `uuid` / `varchar` | Yes | — | **FK** → `locations.id` (`SET NULL` on delete) |
| `name` | `varchar` | No | — | |
| `type` | `varchar` | No | `outdoor` | e.g. `indoor` \| `outdoor` |
| `sport` | `varchar` | No | `tennis` | e.g. `tennis` \| `pickleball` |
| `pricePerHour` | `decimal(12,2)` | No | `0` | Loaded as string in TS |
| `description` | `text` | Yes | — | |
| `imageUrl` | `varchar` | Yes | — | |
| `imageGallery` | `text` | Yes | — | JSON array of image URLs |
| `mapEmbedUrl` | `text` | Yes | — | Maps embed / iframe `src` |
| `status` | `varchar` | No | `active` | e.g. `active` \| `maintenance` |
| `createdAt` | `timestamp` | No | auto | |
| `updatedAt` | `timestamp` | No | auto | |

### `sports`

| Column | DB type | Nullable | Default | Notes |
|--------|---------|----------|---------|--------|
| `id` | `uuid` | No | generated | Primary key |
| `code` | `varchar` | No | — | **Unique**; e.g. `tennis`, `pickleball` |
| `name` | `varchar` | No | — | |
| `description` | `varchar` | Yes | — | |
| `imageUrl` | `varchar` | Yes | — | |
| `createdAt` | `timestamp` | No | auto | |
| `updatedAt` | `timestamp` | No | auto | |

### `roles`

| Column | DB type | Nullable | Default | Notes |
|--------|---------|----------|---------|--------|
| `id` | `uuid` | No | generated | Primary key |
| `name` | `varchar` | No | — | **Unique** |
| `description` | `varchar` | Yes | — | |
| `permissions` | `varchar` | Yes | `''` | Comma-separated codes, e.g. `courts:view,users:view` |
| `createdAt` | `timestamp` | No | auto | |
| `updatedAt` | `timestamp` | No | auto | |

### `users`

| Column | DB type | Nullable | Default | Notes |
|--------|---------|----------|---------|--------|
| `id` | `uuid` | No | generated | Primary key |
| `organizationId` | `varchar` | Yes | — | **Logical FK** → `organizations.id` |
| `branchId` | `varchar` | Yes | — | **Logical FK** → `branches.id` |
| `roleId` | `varchar` | No | — | **FK** → `roles.id` (eager load) |
| `email` | `varchar` | No | — | **Unique with** `organizationId` (`@Unique`) |
| `passwordHash` | `varchar` | Yes | — | Null for OAuth-only users |
| `fullName` | `varchar` | No | — | |
| `phone` | `varchar` | Yes | — | |
| `avatarUrl` | `varchar` | Yes | — | |
| `status` | `varchar` | No | `active` | |
| `googleId` | `varchar` | Yes | — | Google OAuth subject |
| `courtId` | `uuid` | Yes | — | **FK** → `courts.id` (`SET NULL`); coach/staff primary court |
| `visibility` | `varchar(16)` | No | `public` | `public` \| `private` (coach directory) |
| `createdAt` | `timestamp` | No | auto | |
| `updatedAt` | `timestamp` | No | auto | |

### `coaches`

| Column | DB type | Nullable | Default | Notes |
|--------|---------|----------|---------|--------|
| `id` | `uuid` | No | generated | Primary key |
| `userId` | `varchar` | No | — | **FK** → `users.id` (`CASCADE` on delete) |
| `experienceYears` | `int` | No | `0` | |
| `bio` | `text` | Yes | — | |
| `hourlyRate` | `decimal(12,2)` | No | `0` | Loaded as string in TS |
| `createdAt` | `timestamp` | No | auto | |
| `updatedAt` | `timestamp` | No | auto | |

### `court_bookings`

| Column | DB type | Nullable | Default | Notes |
|--------|---------|----------|---------|--------|
| `id` | `uuid` | No | generated | Primary key |
| `organizationId` | `varchar` | Yes | — | **Logical FK** → `organizations.id` |
| `branchId` | `varchar` | Yes | — | **Logical FK** → `branches.id` |
| `courtId` | `varchar` | No | — | **FK** → `courts.id` (`CASCADE`) |
| `userId` | `varchar` | No | — | **FK** → `users.id` (`CASCADE`) |
| `coachId` | `varchar` | Yes | — | **FK** → `coaches.id` (`SET NULL`) |
| `bookingType` | `varchar` | No | `COURT_ONLY` | `COURT_ONLY` \| `COURT_COACH` |
| `bookingDate` | `date` | No | — | |
| `startTime` | `time` | No | — | |
| `endTime` | `time` | No | — | |
| `durationMinutes` | `int` | No | — | |
| `totalPrice` | `decimal(12,2)` | No | `0` | |
| `paymentStatus` | `varchar` | No | `unpaid` | `unpaid` \| `paid` \| `refunded` |
| `bookingStatus` | `varchar` | No | `pending` | `pending` \| `confirmed` \| `cancelled` \| `completed` |
| `createdAt` | `timestamp` | No | auto | |
| `updatedAt` | `timestamp` | No | auto | |

### `coach_sessions`

| Column | DB type | Nullable | Default | Notes |
|--------|---------|----------|---------|--------|
| `id` | `uuid` | No | generated | Primary key |
| `organizationId` | `varchar` | Yes | — | **Logical FK** → `organizations.id` |
| `branchId` | `varchar` | Yes | — | **Logical FK** → `branches.id` |
| `coachId` | `varchar` | No | — | **FK** → `coaches.id` (`CASCADE`) |
| `bookedById` | `varchar` | Yes | — | **Logical FK** → `users.id` (who booked) |
| `courtId` | `varchar` | Yes | — | **FK** → `courts.id` (`SET NULL`) |
| `sessionDate` | `date` | No | — | |
| `startTime` | `time` | No | — | |
| `durationMinutes` | `int` | No | — | |
| `sessionType` | `varchar` | No | `private` | `private` \| `group` |
| `status` | `varchar` | No | `scheduled` | `scheduled` \| `completed` \| `cancelled` |
| `createdAt` | `timestamp` | No | auto | |
| `updatedAt` | `timestamp` | No | auto | |

### `password_reset_tokens`

| Column | DB type | Nullable | Default | Notes |
|--------|---------|----------|---------|--------|
| `id` | `uuid` | No | generated | Primary key |
| `userId` | `varchar` | No | — | **FK** → `users.id` (`CASCADE`) |
| `token` | `varchar` | No | — | **Unique** |
| `expiresAt` | `timestamp` | No | — | |
| `used` | `boolean` | No | `false` | |
| `createdAt` | `timestamp` | No | auto | |

### `refresh_tokens`

| Column | DB type | Nullable | Default | Notes |
|--------|---------|----------|---------|--------|
| `id` | `uuid` | No | generated | Primary key |
| `userId` | `uuid` | No | — | **Logical FK** → `users.id`; indexed (`@Index`) |
| `tokenHash` | `varchar` | No | — | **Unique**; SHA-256 of opaque cookie value |
| `expiresAt` | `timestamptz` | No | — | |
| `longSession` | `boolean` | No | `false` | “Remember me” → longer expiry |
| `createdAt` | `timestamptz` | No | auto | |

---

## Modeled relationships (11)

Each bullet is a **foreign key** enforced in the ORM as `ManyToOne` → parent.

1. **users** → **roles** (`roleId`)
2. **users** → **courts** (`courtId`, optional, `ON DELETE SET NULL`)
3. **locations** → **branches** (`branchId`, `ON DELETE CASCADE`)
4. **courts** → **locations** (`locationId`, optional, `ON DELETE SET NULL`)
5. **password_reset_tokens** → **users** (`userId`, `ON DELETE CASCADE`)
6. **coaches** → **users** (`userId`, `ON DELETE CASCADE`)
7. **court_bookings** → **courts** (`courtId`, `ON DELETE CASCADE`)
8. **court_bookings** → **users** (`userId`, `ON DELETE CASCADE`)
9. **court_bookings** → **coaches** (`coachId`, optional, `ON DELETE SET NULL`)
10. **coach_sessions** → **coaches** (`coachId`, `ON DELETE CASCADE`)
11. **coach_sessions** → **courts** (`courtId`, optional, `ON DELETE SET NULL`)

---

## Logical foreign keys (not TypeORM relations)

These columns store IDs that **should** match rows in other tables; TypeORM does not declare `@ManyToOne` for them (queries join manually or by convention).

| Table | Column(s) | Typically references |
|-------|-----------|----------------------|
| `branches` | `organizationId` | `organizations.id` |
| `users` | `organizationId`, `branchId` | `organizations.id`, `branches.id` |
| `refresh_tokens` | `userId` | `users.id` |
| `court_bookings` | `organizationId`, `branchId` | `organizations.id`, `branches.id` |
| `coach_sessions` | `organizationId`, `branchId`, `bookedById` | `organizations.id`, `branches.id`, `users.id` |

---

## High-level ERD (text)

```
organizations
     └── branches
              └── locations
                       └── courts
                              ↑
users ── roles          court_bookings ── users
  │                         │
  ├── coaches ←─────────────┼── coach_sessions ── coaches
  │                         │
  └── password_reset_tokens │
  └── refresh_tokens (userId)
```

---

## Notes

- **Schema changes** in development often use TypeORM `synchronize` (`DB_SYNC=true`); production should use migrations when sync is off (see `MIGRATION_SETUP.md`, `RENDER_DEPLOY.md`).
- **Seed data** is applied by `SeedService` on application startup (roles, org/branch/locations/courts, sample coaches, etc.).
- Exact PostgreSQL types for `uuid` vs `varchar` on FK columns may match TypeORM’s inferred column type; when in doubt, inspect the live DB or generated migration.
