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

---

## 4. Summary

| Topic           | Notes                                                                 |
|-----------------|-----------------------------------------------------------------------|
| Monorepo        | 1 package.json, apps/ + libs/, nest-cli.json                         |
| Package manager | pnpm, pnpm-lock.yaml                                                  |
| DB              | TypeORM, entities in api app, synchronize in dev                      |
| DB connection   | DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME                           |
