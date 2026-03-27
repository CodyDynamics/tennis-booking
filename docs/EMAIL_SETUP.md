# Email setup (Gmail) & App Password

The backend uses **Gmail SMTP** for transactional email (password reset, login OTP, etc.). Gmail **does not allow** normal account passwords for third-party apps — you must create an **App Password**.

## Getting a Gmail App Password (`EMAIL_PASSWORD`)

### Step 1: Enable 2-Step Verification

1. Open [Google Account](https://myaccount.google.com/) → **Security**.
2. Under **How you sign in to Google**, choose **2-Step Verification**.
3. Turn on 2-Step Verification and complete the steps (phone, verification codes).

### Step 2: Create an App Password

**Note:** **App passwords** are **not** on the main Security list. Open **2-Step Verification** first — the App passwords option appears **inside** that page.

1. Go to [Google Account](https://myaccount.google.com/) → **Security**.
2. Open **2-Step Verification** (line showing it is enabled, e.g. “On since …”).
3. On the **2-Step Verification** page, **scroll to the bottom** → open **App passwords**.
4. Under **Select app**, choose **Mail**; under **Select device**, choose **Other (Custom name)** and enter a name (e.g. `Booking Tennis Backend`).
5. Click **Generate**. Google shows a **16-character password** (format `xxxx xxxx xxxx xxxx`).

### Step 3: Configure `.env`

- **EMAIL_USER**: your Gmail address (e.g. `your-email@gmail.com`).
- **EMAIL_PASSWORD**: paste the **App Password** (spaces optional, e.g. `abcdefghijklmnop`).

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
EMAIL_FROM=noreply@booking-tennis.com
```

After saving `.env`, restart the backend and try sending mail (forgot password or login OTP).

## Notes

- An App Password is **not** your normal Gmail password.
- If you change your Google password or disable 2-Step Verification, App Passwords may stop working — create a new App Password if needed.
- To use **Resend** instead of SMTP, see [RESEND_SETUP.md](./RESEND_SETUP.md) (`MAIL_PROVIDER=resend` and `RESEND_API_KEY`), including resend.dev deliverability test scenarios.

## Gmail API provider (`MAIL_PROVIDER=cloud`)

If you want to send mail without SMTP, this project supports Gmail API using OAuth credentials from Google API Console.

Required env vars:

```env
MAIL_PROVIDER=cloud
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxx
GOOGLE_REFRESH_TOKEN=xxxx
GOOGLE_SENDER_EMAIL=your-email@gmail.com
GOOGLE_OAUTH_REDIRECT_URI=https://developers.google.com/oauthplayground
EMAIL_FROM=Booking Tennis <your-email@gmail.com>
```

Notes:

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` come from OAuth Client in Google API Console.
- `GOOGLE_REFRESH_TOKEN` is required so backend can refresh access token automatically.
- `GOOGLE_SENDER_EMAIL` is the Gmail account to send as (`me` is used when omitted).
