# Database migrations

This backend now includes TypeORM migration scripts.

## 1) Ensure DB env vars are set

At minimum in `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_NAME=booking_tennis
```

## 2) Run pending migrations

```bash
cd backend
pnpm migration:run
```

## 3) Revert last migration (if needed)

```bash
cd backend
pnpm migration:revert
```

## 4) Create/generate new migration

```bash
cd backend
pnpm migration:create --name=my-new-change
# or
pnpm migration:generate --name=my-new-change
```

## Included migration for current refactor

The repository includes:

- `apps/api/src/database/migrations/1711540000000-phase2-hierarchy-and-user-fields.ts`

It applies:

- notifications reminder column on `court_bookings`
- `users` first/last name + first-login password-change flag
- location parent/child hierarchy (`parentLocationId`, `kind`)
- new `areas` table
- `courts.areaId` + `courts.sportId`
- basic backfill (`courts.sport` -> `courts.sportId`, split `users.fullName`)
