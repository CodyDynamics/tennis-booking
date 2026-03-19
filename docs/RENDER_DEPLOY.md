# Deploy Backend lên Render.com

## Lỗi `relation "sports" does not exist`

Trên production (Render), app tắt **TypeORM synchronize** nên không tự tạo bảng. Database Postgres trên Render mới tạo sẽ trống → khi SeedService chạy (hoặc API gọi bảng `sports`) sẽ báo lỗi **relation "sports" does not exist**.

## Cách xử lý: Bật sync cho lần deploy đầu

1. Vào **Render Dashboard** → chọn **Web Service** (backend) → **Environment**.
2. Thêm biến môi trường:
   - **Key:** `DB_SYNC`
   - **Value:** `true`
3. **Save** và **Deploy** lại (hoặc đợi redeploy).

Sau khi deploy xong, TypeORM sẽ tạo toàn bộ bảng (users, roles, sports, courts, …) và SeedService chạy seed dữ liệu mặc định.

### Sau lần chạy đầu (tùy chọn)

Nếu muốn tắt auto-sync để tránh thay đổi schema khi đổi entity:

- Xóa biến `DB_SYNC` hoặc đặt `DB_SYNC=false`, rồi deploy lại.  
- Lưu ý: từ lúc đó nếu bạn thêm/sửa entity, cần tự tạo và chạy migration (hoặc tạm bật lại `DB_SYNC=true` cho một lần deploy).

## Lỗi 500 trên `/auth/request-login-otp` (OTP gửi chậm / không gửi được)

Trên Render, request OTP có thể **rất chậm** hoặc **500** vì:

1. **Gửi email (Gmail SMTP)** – Render có thể chặn hoặc throttle kết nối ra cổng 587. Gmail có thể timeout hoặc từ chối.
2. **Không thấy log** – Sau khi thêm middleware, mỗi request sẽ in ra log dạng `POST /auth/request-login-otp 500 15234ms`. Nếu vẫn không thấy gì thì request chưa tới backend (kiểm tra URL API trên frontend, CORS, hoặc Render chưa nhận traffic).

**Đã xử lý trong code:**

- Timeout SMTP 15s (connection) + 10s (greeting) để tránh treo lâu.
- Bắt lỗi gửi email, ghi log chi tiết và trả **503** với message rõ ràng thay vì 500 chung chung.
- Middleware log mỗi request (method, path, status, duration) để dễ debug trên Render Logs.

**Bạn cần làm:**

- Trên Render → **Environment**: cấu hình đủ `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` (dùng Gmail App Password, xem `docs/EMAIL_SETUP.md`).
- Mở **Logs** của Web Service trên Render: khi login bạn sẽ thấy dòng `POST /auth/request-login-otp ...`. Nếu lỗi gửi email sẽ có dòng `[AuthService] Send OTP email failed for ...` kèm nguyên nhân (timeout, ECONNREFUSED, auth failed, v.v.).
- Nếu Render chặn SMTP: cân nhắc dùng dịch vụ email khác (SendGrid, Mailgun, Resend) hỗ trợ tốt trên cloud, hoặc dùng Gmail qua relay có hỗ trợ.

### Lỗi 503 "Unable to send verification email"

Backend trả **503** khi không gửi được email OTP (đúng nghĩa "service unavailable"). **Đổi sang 403 hay mã khác không làm email gửi được** – cần xử lý nguyên nhân (SMTP trên Render bị chặn/timeout).

**Cách dùng tạm khi chưa cấu hình email ổn trên Render:**

- Trên Render → **Environment** thêm: **`LOGIN_OTP_ENABLED`** = **`false`**.
- Deploy lại → login sẽ **không** qua OTP (chỉ email + password), không cần gửi email. Khi nào đã cấu hình xong email (hoặc dùng SendGrid/Resend), đặt `LOGIN_OTP_ENABLED=true` để bật lại OTP.

## Biến môi trường cần thiết trên Render

- `NODE_ENV=production`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` (lấy từ Render Postgres)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` (đặt giá trị bí mật)
- `DB_SYNC=true` (cho lần deploy đầu để tạo bảng)
- **Email (để gửi OTP):** `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`
- **Tùy chọn:** `LOGIN_OTP_ENABLED=false` để tắt login OTP (chỉ login bằng email + password) khi chưa gửi email được trên Render.
- Các biến khác: `FRONTEND_URL` (URL frontend Vercel để CORS), v.v.
