# Cấu hình Email (Gmail) & Lấy App Password

Backend dùng Gmail SMTP để gửi email (quên mật khẩu, OTP đăng nhập, v.v.). Gmail **không cho phép** dùng mật khẩu đăng nhập thông thường cho ứng dụng bên thứ ba, nên bạn cần tạo **App Password**.

## Cách lấy Gmail App Password (EMAIL_PASSWORD)

### Bước 1: Bật xác minh 2 bước (2-Step Verification)

1. Vào [Google Account](https://myaccount.google.com/) → **Security**.
2. Trong mục **How you sign in to Google**, chọn **2-Step Verification**.
3. Bật 2-Step Verification và hoàn tất các bước (số điện thoại, mã xác minh).

### Bước 2: Tạo App Password (Mật khẩu ứng dụng)

**Lưu ý:** Mục "App passwords" / "Mật khẩu ứng dụng" **không nằm** trong danh sách chính của trang Security. Bạn phải **vào trong** mục **Xác minh 2 bước** (2-Step Verification) mới thấy.

1. Vào [Google Account](https://myaccount.google.com/) → **Bảo mật** (Security).
2. Bấm vào **Xác minh 2 bước** (2-Step Verification) — dòng có ghi "Bật từ …".
3. Trong trang **Xác minh 2 bước**, **cuộn xuống cuối trang** → tìm và bấm **Mật khẩu ứng dụng** (App passwords).
4. Ở **Select app** chọn **Mail**, ở **Select device** chọn **Other (Custom name)** và đặt tên (ví dụ: `Booking Tennis Backend`).
5. Bấm **Generate** / **Tạo**. Google sẽ hiển thị **mật khẩu 16 ký tự** (dạng `xxxx xxxx xxxx xxxx`).

### Bước 3: Cấu hình trong `.env`

- **EMAIL_USER**: địa chỉ Gmail của bạn (ví dụ: `your-email@gmail.com`).
- **EMAIL_PASSWORD**: dán **App Password** vừa tạo (có thể bỏ dấu cách, ví dụ: `abcdefghijklmnop`).

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
EMAIL_FROM=noreply@booking-tennis.com
```

Sau khi lưu `.env`, khởi động lại backend và thử gửi email (quên mật khẩu hoặc OTP đăng nhập).

## Lưu ý

- App Password **không phải** mật khẩu đăng nhập Gmail.
- Nếu đổi mật khẩu Google hoặc tắt 2-Step Verification, App Password có thể bị vô hiệu; khi đó cần tạo App Password mới.
