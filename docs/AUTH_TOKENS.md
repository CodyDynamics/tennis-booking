# Access token, Refresh token & Redis (theo guideline)

## 1. Access Token (AT)

- **JWT** có `jti` (UUID) để có thể **blacklist** khi logout.
- **Thời hạn ngắn**: mặc định **15 phút** (`JWT_EXPIRES_IN=15m`, `COOKIE_ACCESS_MAX_AGE_SECONDS=900`).
- **Client**:
  - **HttpOnly cookie** (`access_token`) — backend set khi login/register/refresh/verify-otp.
  - **JSON body** trả thêm `accessToken` — SPA có thể lưu **memory** nếu muốn (không bắt buộc).
- Gọi API: header `Authorization: Bearer <AT>` hoặc cookie (đã cấu hình trong `JwtStrategy`).

## 2. Refresh Token (RT)

- **Không còn** là JWT refresh — là **chuỗi ngẫu nhiên** (base64url), chỉ gửi qua **HttpOnly cookie** `refresh_token`.
- **Postgres** bảng `refresh_tokens`:
  - `token_hash` = SHA-256 của RT thô (không lưu RT plaintext).
  - `user_id`, `expires_at`, `long_session` (Remember me → 30 ngày, mặc định 7 ngày).
- **Refresh**: client gọi `POST /auth/refresh` với cookie RT → server tìm hash trong DB, xóa dòng cũ (rotation), tạo AT + RT mới.

## 3. Redis

- **Blacklist AT đã logout**: key `auth:at:blacklist:{jti}`, TTL = thời gian còn lại của JWT.
- `POST /auth/logout`: đọc cookie AT + RT → xóa RT trong Postgres, đưa `jti` của AT vào Redis.
- `JwtStrategy`: trước khi chấp nhận user, kiểm tra `jti` có trong blacklist không.

### Cấu hình

| Biến | Ý nghĩa |
|------|--------|
| `REDIS_HOST`, `REDIS_PORT` | Kết nối Redis (mặc định localhost:6379) |
| `REDIS_ENABLED=false` | Tắt Redis → **không** blacklist AT (logout vẫn xóa RT trong DB) |

Trên môi trường không có Redis (hoặc không muốn dùng), set `REDIS_ENABLED=false`. Refresh token vẫn bị thu hồi khi logout nhờ xóa trong Postgres.

## 4. Migration / DB

- Bảng `refresh_tokens` được tạo khi **TypeORM synchronize** bật (dev hoặc `DB_SYNC=true` lần đầu trên Render).
- User đang dùng **JWT refresh cũ** trong cookie sẽ cần **đăng nhập lại** sau khi deploy (RT mới là opaque + DB).
