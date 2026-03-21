# Access token, refresh token & Redis

## 1. Access token (AT)

- **JWT** includes a **`jti`** (UUID) so the token can be **blacklisted** on logout.
- **Short lifetime**: default **15 minutes** (`JWT_EXPIRES_IN=15m`, `COOKIE_ACCESS_MAX_AGE_SECONDS=900`).
- **Client**:
  - **HttpOnly cookie** (`access_token`) — set by the backend on login / register / refresh / verify-OTP.
  - **JSON body** also returns `accessToken` — SPAs may keep it in **memory** (optional).
- **API calls**: send `Authorization: Bearer <AT>` or rely on the cookie (see `JwtStrategy`).

## 2. Refresh token (RT)

- **Not** a JWT refresh token — an **opaque random string** (base64url), only in the **HttpOnly** `refresh_token` cookie.
- **Postgres** table `refresh_tokens`:
  - `token_hash` = SHA-256 of the raw RT (plaintext RT is never stored).
  - `user_id`, `expires_at`, `long_session` (Remember me → 30 days; default 7 days).
- **Refresh**: client calls `POST /auth/refresh` with the RT cookie → server looks up the hash, deletes the old row (**rotation**), issues new AT + RT.

## 3. Redis

- **Blacklist logged-out ATs**: key `auth:at:blacklist:{jti}`, TTL = remaining JWT lifetime.
- `POST /auth/logout`: reads AT + RT cookies → deletes RT in Postgres, adds AT `jti` to Redis.
- **JwtStrategy**: before accepting the user, checks whether `jti` is blacklisted.

### Configuration

| Variable | Meaning |
|----------|---------|
| `REDIS_HOST`, `REDIS_PORT` | Redis connection (default `localhost:6379`) |
| `REDIS_ENABLED=false` | Disables Redis → **no** AT blacklist (logout still deletes RT in Postgres) |

If Redis is unavailable or unused, set `REDIS_ENABLED=false`. Refresh tokens are still revoked on logout via Postgres.

## 4. Migrations / DB

- Table `refresh_tokens` is created when **TypeORM synchronize** is on (local dev or first Render deploy with `DB_SYNC=true`).
- Users still holding an **old JWT refresh** in a cookie must **sign in again** after deploy (new RT is opaque + stored in DB).
