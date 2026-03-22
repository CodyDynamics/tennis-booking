# Migration Setup – Backend

Summary of migrations (monorepo structure, pnpm, database).

---

## 1. Migration from services/ to apps/ (NestJS Monorepo)

Backend uses a NestJS monorepo with `apps/` instead of `services/`.

### Current structure

- **apps/api:** Nest application (no separate package.json).
- **libs/common**, **libs/messaging:** shared libraries.
- Single **package.json** and **pnpm-lock.yaml** at backend root.
- **nest-cli.json** declares projects (api, common, messaging).

### Build & run

- Dev: `pnpm run start:dev`.
- Build: `pnpm run build` (output: `dist/apps/api/`).
- Shared imports: use aliases `@app/common`, `@app/messaging` (paths in tsconfig).

### If migrating from the old structure (services/)

1. Backup, move code from `services/*` to `apps/*`.
2. Remove `services/`.
3. `rm pnpm-lock.yaml && pnpm install`.
4. `pnpm run build`, then run the app to test.

---

## 2. Migration from npm to pnpm

- **Lock file:** `package-lock.json` → `pnpm-lock.yaml`.
- **Config:** `pnpm-workspace.yaml`, `.npmrc` (shamefully-hoist, auto-install-peers).
- **Install pnpm:** `corepack enable && corepack prepare pnpm@latest --activate` or `npm install -g pnpm`.
- **Commands:** `npm install` → `pnpm install`, `npm run x` → `pnpm run x`, add dependency: `pnpm add <pkg>`.

---

## 3. Database (TypeORM)

- **ORM:** TypeORM with `synchronize: true` in development (tables auto-created/updated).
- **Entities:** `apps/api/src/auth/entities/` (User, Role, PasswordResetToken).
- **Connection:** Use env vars `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` (default: localhost:5433, DB `booking_tennis`).
- **Seed:** Default roles (admin, player, coach, student, parent) are created when the API starts (SeedService).

### 3.1 `NOT NULL` columns & `synchronize` (e.g. `users.phone`)

TypeORM **does not** run data backfills. If you change a column from **nullable → required** (`NOT NULL`) and old rows still have `NULL`, Postgres will error:

`column "phone" of relation "users" contains null values`

**Fix (pick one):**

1. **Backfill then restart API** (keeps data): run SQL once, then let `DB_SYNC` apply the rest:
   - See `scripts/sql/backfill-users-phone-before-not-null.sql`
   - Example: `psql ... -f scripts/sql/backfill-users-phone-before-not-null.sql`

2. **Formal migration** (production): a migration should (a) `UPDATE ... WHERE phone IS NULL`, (b) `ALTER COLUMN ... SET NOT NULL`. Same idea as (1), but versioned (TypeORM CLI migrations, Flyway, etc.).

3. **Dev only — wipe DB**: drop/recreate database or `docker compose down -v` then `up` so sync builds a fresh schema (no NULL rows).

---


## 4. Summary

| Topic           | Notes                                                                 |
|-----------------|-----------------------------------------------------------------------|
| Monorepo        | 1 package.json, apps/ + libs/, nest-cli.json                         |
| Package manager | pnpm, pnpm-lock.yaml                                                  |
| DB              | TypeORM, entities in api app, synchronize in dev                      |
| DB connection   | DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME                           |
