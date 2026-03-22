-- Run ONCE before TypeORM synchronize can set users.phone to NOT NULL.
-- `pnpm run start:dev` does NOT execute this file — you must run SQL manually first.
--
-- Easiest (reads DB_* from backend/.env; needs `psql` in PATH, or running Docker postgres):
--   cd backend && pnpm run db:backfill-phone
-- If you see "psql: command not found": brew install libpq (macOS) and add libpq/bin to PATH.
--
-- Manual psql (match your .env DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME):
--   PGPASSWORD=yourpass psql -h localhost -p 5432 -U postgres -d booking_tennis -f scripts/sql/backfill-users-phone-before-not-null.sql
--
-- If Postgres is Docker with host port 5433 (see docker-compose):
--   PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d booking_tennis -f scripts/sql/backfill-users-phone-before-not-null.sql

UPDATE "users"
SET "phone" = '+10000000000'
WHERE "phone" IS NULL;

-- Optional: replace placeholder with something traceable per row
-- UPDATE "users" SET "phone" = '+10000000000' || substring(replace(id::text, '-', ''), 1, 10) WHERE "phone" = '+10000000000';
