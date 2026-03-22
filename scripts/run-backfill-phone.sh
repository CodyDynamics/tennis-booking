#!/usr/bin/env bash
# Backfill users.phone so TypeORM can set NOT NULL (see docs/MIGRATION_SETUP.md §3.1).
# Run from backend root:  bash scripts/run-backfill-phone.sh
# Or:                     pnpm run db:backfill-phone
#
# We only read DB_* keys from .env (no `source .env`) so values with spaces
# in other vars (e.g. EMAIL_PASSWORD) cannot break the shell.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env in $ROOT — create it or set DB_* vars manually."
  exit 1
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line//[:space:]}" ]] && continue
  if [[ "$line" =~ ^(DB_HOST|DB_PORT|DB_USER|DB_PASS|DB_NAME)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    val="${BASH_REMATCH[2]}"
    val="${val%$'\r'}"
    if [[ "$val" =~ ^\"(.*)\"$ ]]; then
      val="${BASH_REMATCH[1]}"
    elif [[ "$val" =~ ^\'(.*)\'$ ]]; then
      val="${BASH_REMATCH[1]}"
    fi
    export "$key=$val"
  fi
done < "$ENV_FILE"

export PGPASSWORD="${DB_PASS:-postgres}"
HOST="${DB_HOST:-localhost}"
PORT="${DB_PORT:-5432}"
USER="${DB_USER:-postgres}"
DB="${DB_NAME:-booking_tennis}"

SQL="$ROOT/scripts/sql/backfill-users-phone-before-not-null.sql"
if [[ ! -f "$SQL" ]]; then
  echo "SQL file not found: $SQL"
  exit 1
fi

# Resolve psql: PATH → Postgres.app → Docker (same DB only if you use that container)
PSQL_CMD=""
if command -v psql >/dev/null 2>&1; then
  PSQL_CMD="psql"
else
  for candidate in \
    "/Applications/Postgres.app/Contents/Versions/latest/bin/psql" \
    "/opt/homebrew/opt/libpq/bin/psql" \
    "/usr/local/opt/libpq/bin/psql"; do
    if [[ -x "$candidate" ]]; then
      PSQL_CMD="$candidate"
      break
    fi
  done
fi

DOCKER_PG="${DOCKER_PG_CONTAINER:-booking-tennis-postgres}"

if [[ -n "$PSQL_CMD" ]]; then
  echo "Running backfill via psql → postgresql://$USER@$HOST:$PORT/$DB ..."
  "$PSQL_CMD" -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -f "$SQL"
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$DOCKER_PG"; then
  echo "psql not in PATH — using Docker container \"$DOCKER_PG\" (database: $DB, user: $USER) ..."
  echo "If your data is on host Postgres instead, install psql: brew install libpq"
  # shellcheck disable=SC2002
  cat "$SQL" | docker exec -i -e PGPASSWORD="${PGPASSWORD}" "$DOCKER_PG" \
    psql -h localhost -p 5432 -U "$USER" -d "$DB" -v ON_ERROR_STOP=1
else
  echo "ERROR: PostgreSQL client (psql) not found, and Docker container \"$DOCKER_PG\" is not running."
  echo ""
  echo "Fix one of:"
  echo "  1) macOS + Homebrew:  brew install libpq"
  echo "     then add to PATH:   echo 'export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\"' >> ~/.zshrc && source ~/.zshrc"
  echo "  2) Postgres.app:      use its psql or add .../Postgres.app/.../bin to PATH"
  echo "  3) Docker Compose:    cd backend && docker compose up -d postgres"
  echo "     then re-run:       pnpm run db:backfill-phone"
  exit 1
fi

echo "Done. Now start the API: pnpm run start:dev"
