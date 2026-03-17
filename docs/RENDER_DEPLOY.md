# Deploy Backend lên Render.com

## Build Command

Khi `NODE_ENV=production`, pnpm sẽ **bỏ qua devDependencies** (trong đó có `@nestjs/cli`). Script `nest build` cần Nest CLI nên build sẽ lỗi `nest: not found`.

**Cách xử lý:** Dùng script build cài đủ devDependencies rồi mới build:

- **Build Command:** `pnpm run build:render`

Script `build:render` chạy `NODE_ENV=development pnpm install` (cài cả devDependencies) rồi `pnpm run build`. Ở bước **Start**, Render vẫn dùng `NODE_ENV=production` từ Environment nên app chạy đúng môi trường production.

## Start Command

- **Start Command:** `node dist/apps/api/src/main`

## Environment (Render Dashboard)

Giữ **NODE_ENV=production** (cho runtime). Thêm các biến cần thiết, ví dụ:

- `FRONTEND_URL` = `https://tennis-booking-frontend-red.vercel.app` (dùng cho CORS và redirect)
- `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, v.v.

**Cookie cross-origin:** Ở production backend mặc định set cookie với **SameSite=None** và **Secure** để trình duyệt gửi cookie khi frontend (Vercel) và backend (Render) khác origin. Nếu vẫn bị 401 sau F5, user cần **đăng xuất và đăng nhập lại một lần** để nhận cookie mới.

## Root Directory

Nếu repo có cả frontend: đặt **Root Directory** = `backend`.
