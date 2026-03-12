# Project Structure – Backend

Documentation of the backend directory structure and main components.

---

## Overview

Backend is a **NestJS monorepo**: one repo, one `package.json`, multiple apps and shared libraries.

- **Application:** API (monolith – entry point, auth, users).
- **Infrastructure:** PostgreSQL, Redis.
- **Shared:** libs/common (DTOs, guards, filters, decorators), libs/messaging (RabbitMQ config if needed).

---

## Main directory tree

```
backend/
├── apps/
│   └── api/                    # API monolith – entry point
│       ├── src/
│       │   ├── auth/           # Login, register, JWT, Google OAuth, forgot/reset password
│       │   ├── users/
│       │   ├── database/       # SeedService, roles
│       │   ├── email/
│       │   ├── rsa/            # RSA key pair, public key endpoint
│       │   ├── health/
│       │   ├── config/
│       │   └── main.ts
│       ├── keys/               # RSA keys (auto-generated or manual)
│       ├── Dockerfile
│       ├── tsconfig.app.json
│       └── ...
│
├── libs/
│   ├── common/                 # Shared: DTOs, guards, filters, decorators, interceptors
│   │   └── src/
│   └── messaging/             # RabbitMQ config
│       └── src/
│
├── package.json                # Dependencies & scripts (root only)
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── nest-cli.json               # Defines projects: api, common, messaging
├── tsconfig.json               # Base TypeScript config
└── docker-compose.yml          # postgres, redis, api
```

---

## Nest CLI (nest-cli.json)

- **projects:**
  - `api`: type `application`, entry `main`, sourceRoot in `apps/api`.
  - `common`, `messaging`: type `library`, entry `index`, sourceRoot in `libs/`.
- **Monorepo:** `monorepo: true`, `sourceRoot: "apps"`.

---

## How to run

- **API:** `pnpm run start:dev` → port 3000.
- **Build:** `pnpm run build`.

---

## Request flow

1. Client calls **API** (http://localhost:3000).
2. API handles routes (e.g. `/auth/*`, `/users/*`, `/rsa/*`) directly.
3. API uses **TypeORM** (PostgreSQL), **Redis**, **RSA**, **Email** (as configured).

---

## Important config files

| File | Purpose |
|------|---------|
| `package.json` | Scripts, dependencies (entire monorepo) |
| `nest-cli.json` | Defines apps & libs |
| `tsconfig.json` | Base TS, paths (@app/common, @app/messaging) |
| `docker-compose.yml` | Services: postgres, redis, api |
| `apps/api/src/config/configuration.ts` | Env-based configuration |

---

## Related docs

- **DOCKER_SETUP.md** – Docker for backend.
- **LOCAL_SETUP.md** – Local run step by step.
- **MIGRATION_SETUP.md** – Monorepo, pnpm, database migration.
- **NEW_SERVICE_GUIDE.md** – Step-by-step: creating a new feature with NestJS CLI.
- **UNIT_TEST_GUIDE.md** – Step-by-step: writing unit tests for controllers and services.
- **DESIGN_PATTERNS.md** – Architecture and design patterns for the backend.
