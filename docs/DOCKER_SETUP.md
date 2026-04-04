# Docker Setup – Backend

Guide for using Docker with the backend project (PostgreSQL, Redis, API monolith).

---

## Requirements

- Docker & Docker Compose
- Run `pnpm install` in the backend first (so `pnpm-lock.yaml` exists) before building images

---

## 1. Create pnpm-lock.yaml before building

Docker build needs `pnpm-lock.yaml` to install dependencies. Generate it before building:

```bash
cd backend
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
```

---

## 2. Environment variables (optional)

Docker Compose reads **`backend/.env`** automatically (same file as local `nest start`). Override defaults there; compose interpolates `${VAR:-default}` from it.

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=booking_tennis
POSTGRES_PORT=5433
REDIS_PORT=6379
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
FRONTEND_URL=http://localhost:3000
```

---

## 3. Build & run (single command from backend root)

**Run everything (infra + API), building images if needed:**

```bash
cd backend
docker-compose up -d --build
```

Or use the script:

```bash
cd backend
pnpm run docker:up:build
```

Once containers are healthy, use the API at: `http://localhost:3000` (e.g. `curl http://localhost:3000/health`).

### Infrastructure only (PostgreSQL, Redis)

```bash
docker-compose up -d postgres redis
docker-compose ps
```

### Build the API service

```bash
docker-compose build api
```

---

## 4. Scripts (package.json)

```bash
pnpm run docker:up              # Start all
pnpm run docker:down            # Stop all
pnpm run docker:build          # Rebuild images
pnpm run docker:logs           # All logs
pnpm run docker:logs:api       # API logs
pnpm run docker:logs:postgres   # PostgreSQL logs
pnpm run docker:logs:redis      # Redis logs
```

---

## 5. After Docker is up

- **Database:** The API uses TypeORM with `synchronize: true` in dev: on first run it creates tables and seeds default roles. No manual migration needed.
- **Verify:**
  - API: http://localhost:3000/health

---

## 6. Docker structure

- **postgres:** PostgreSQL 15, port 5433:5432, volume `postgres_data`
- **redis:** Redis 7, port 6379, volume `redis_data`
- **api:** Built from `apps/api/Dockerfile`, backend root context; mounts `apps/api/keys`

Dockerfile: single-stage, uses pnpm, copies `apps/`, `libs/`, installs dependencies at root.

---

## 7. Troubleshooting

- **pnpm-lock.yaml is absent:** Run `pnpm install` in the backend.
- **Cannot install with "frozen-lockfile":** Ensure `pnpm-lock.yaml` exists and is COPY'd in the Dockerfile.
- **Service 500 / OpenSSL:** Rebuild without cache:  
  `docker-compose build api --no-cache` then `docker-compose up -d api`.

---

**Note:** Commit `pnpm-lock.yaml` to git so CI/CD and Docker builds stay stable.

---

## 8. Adding a new service (e.g. booking)

When you add another app (e.g. `booking-service`):

1. Add a new **service block** in `docker-compose.yml` (same level as `api`).
2. Set `build.context: .`, `build.dockerfile: apps/booking-service/Dockerfile`.
3. Set `environment` (DB, Redis, gateway/auth URLs if needed).
4. Set `depends_on` (postgres, redis, …).
5. Set `ports` (e.g. `"3002:3002"`) and `networks: [booking-tennis-network]`.
6. Create `apps/booking-service/Dockerfile` (copy monorepo, `pnpm install`, `nest build booking-service`, `CMD node dist/apps/booking-service/main.js`).
7. Run again: `docker-compose up -d --build`. You may need to add routes to the gateway for the new service.
