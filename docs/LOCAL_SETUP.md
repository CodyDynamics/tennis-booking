# Local Setup – Backend

Guide for running the backend locally (development).

---

## Requirements

- Node.js >= 18
- pnpm >= 8
- Docker & Docker Compose (for PostgreSQL, Redis)

---

## 1. Install dependencies

```bash
cd backend
corepack enable && corepack prepare pnpm@latest --activate
pnpm install
```

---

## 2. Environment configuration

Create `.env` in the backend root (or copy from `.env.example`).

Example (TypeORM uses DB_* or defaults):

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASS=postgres
DB_NAME=booking_tennis
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
```

**Important:** Use a strong `JWT_SECRET` in production.

---

## 3. Run infrastructure (Docker)

```bash
docker-compose up -d postgres redis
docker-compose ps
```

---

## 4. Database (TypeORM)

TypeORM uses `synchronize: true` in development: tables (users, roles, password_reset_tokens) are created/updated automatically when the API runs. Default roles (admin, player, coach, student, parent) are seeded on startup.

---

## 5. Run the application

```bash
pnpm run start:dev
```

→ http://localhost:3000

---

## 6. Verify

```bash
curl http://localhost:3000/health
```

---

## 7. Test API

- Get RSA public key: `curl http://localhost:3000/rsa/public-key`
- Get `roleId`: after first run, roles are seeded; query:  
  `docker exec -it booking-tennis-postgres psql -U postgres -d booking_tennis -c "SELECT id, name FROM roles;"`
- Register: `POST http://localhost:3000/auth/register` (body: email, password, fullName, phone, roleId)
- Login: `POST http://localhost:3000/auth/login` (email, password)
- Profile (requires JWT): `GET http://localhost:3000/users/profile` header `Authorization: Bearer <accessToken>`

---

## 8. Common issues

- **Port in use:** `lsof -i :3000` → `kill -9 <PID>` or change port in `.env`.
- **Database:** Check `docker-compose ps postgres` and that `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` in `.env` are correct.

---

## Quick commands

```bash
pnpm install
pnpm run start:dev
docker-compose up -d postgres redis
docker-compose down
```
