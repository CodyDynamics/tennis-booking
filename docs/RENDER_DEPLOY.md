# Deploying the backend to Render.com

## Error: `relation "sports" does not exist`

On production (Render), the app usually has **TypeORM synchronize** disabled, so tables are **not** auto-created. A new Render Postgres database is empty → when `SeedService` runs (or any API hits the `sports` table), Postgres returns **`relation "sports" does not exist`**.

## Fix: enable sync for the first deploy

1. Open **Render Dashboard** → your **Web Service** (backend) → **Environment**.
2. Add:
   - **Key:** `DB_SYNC`
   - **Value:** `true`
3. **Save** and **Deploy** again (or wait for redeploy).

After deploy, TypeORM creates all tables (`users`, `roles`, `sports`, `courts`, …) and `SeedService` can seed default data.

### After the first run (optional)

To turn off auto-sync and avoid accidental schema changes when entities change:

- Remove `DB_SYNC` or set `DB_SYNC=false`, then redeploy.  
- **Note:** from then on, entity changes require **migrations** (or temporarily set `DB_SYNC=true` for one deploy).

## HTTP 500 on `/auth/request-login-otp` (slow OTP / email not sent)

On Render, OTP requests may be **very slow** or return **500** because:

1. **Email (Gmail SMTP)** — Render may block or throttle outbound port **587**; Gmail may time out or reject.
2. **No logs** — With request logging middleware, each request logs like `POST /auth/request-login-otp 500 15234ms`. If you see nothing, the request may not reach the backend (check frontend API URL, CORS, or Render routing).

**Implemented in code:**

- SMTP timeouts: 15s (connection) + 10s (greeting) to avoid hanging.
- Email errors are caught, logged, and return **503** with a clear message instead of a generic 500.
- Middleware logs method, path, status, and duration for **Render Logs**.

**What you should do:**

- In Render → **Environment**, set `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` (Gmail App Password — see `docs/EMAIL_SETUP.md`).
- Open the Web Service **Logs** on Render: on login you should see `POST /auth/request-login-otp ...`. Email failures log `[AuthService] Send OTP email failed for ...` with the reason (timeout, `ECONNREFUSED`, auth failed, etc.).
- If Render blocks SMTP, use a transactional provider (**SendGrid**, **Mailgun**, **Resend**) or a relay that works on your host.

### HTTP 503 “Unable to send verification email”

The backend returns **503** when the OTP email cannot be sent (true “service unavailable”). **Changing the status code to 403 does not fix delivery** — fix SMTP/network or use another provider.

**Temporary workaround if email is not reliable on Render:**

- In Render → **Environment**, set **`LOGIN_OTP_ENABLED`** = **`false`**.
- Redeploy → login uses **email + password only** (no OTP email). When email is ready, set `LOGIN_OTP_ENABLED=true` again.

## Required environment variables on Render

- `NODE_ENV=production`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` (from Render Postgres)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` (strong secrets)
- `DB_SYNC=true` (first deploy only, to create tables)
- **Email (OTP):** `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`
- **Optional:** `LOGIN_OTP_ENABLED=false` to disable OTP login when email is not configured on Render.
- **Redis:** `REDIS_HOST` / `REDIS_PORT` (or a Render Redis add-on). Set `REDIS_ENABLED=false` if you have no Redis — refresh tokens are still removed in Postgres on logout, but old access tokens are **not** blacklisted in Redis.
- **Auth:** After deploy, table `refresh_tokens` exists; users with an **old JWT refresh** cookie must **sign in again** once.
- Other: `FRONTEND_URL` (e.g. Vercel URL for CORS), `JWT_EXPIRES_IN=15m`, etc. See `docs/AUTH_TOKENS.md`.
