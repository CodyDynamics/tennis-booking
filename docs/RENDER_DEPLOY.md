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

## Biến môi trường cần thiết trên Render

- `NODE_ENV=production`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` (lấy từ Render Postgres)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` (đặt giá trị bí mật)
- `DB_SYNC=true` (cho lần deploy đầu để tạo bảng)
- Các biến khác: `FRONTEND_URL`, `EMAIL_*`, v.v. theo nhu cầu.
