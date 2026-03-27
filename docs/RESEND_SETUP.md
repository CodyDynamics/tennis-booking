# Resend (transactional email)

The API can send mail via **SMTP** (e.g. Gmail) or **Resend**. This guide walks through Resend from zero to first email.

## Step 1: Create a Resend account

1. Open [https://resend.com](https://resend.com) and sign up.
2. In the dashboard, go to **API Keys** and click **Create API Key**.
3. Name it (e.g. `booking-tennis-dev`), choose permission **Sending access**, then create and **copy the key** (starts with `re_`). You will not see it again.

## Step 2: Add a domain (production)

For production you should send from **your own domain** (better deliverability than the shared Resend test domain).

1. In Resend: **Domains** → **Add domain** → enter e.g. `mail.yourdomain.com` or `yourdomain.com`.
2. Add the **DNS records** Resend shows (usually TXT for verification, MX/CNAME as instructed).
3. Wait until the domain shows as **Verified**.

For **local development only**, Resend allows sending to your own verified address using their onboarding domain; check the current Resend docs for the exact “test” / development sender rules.

## Step 3: Choose a From address

- `EMAIL_FROM` must use a **sender Resend accepts** for your account:
  - On a verified domain: e.g. `Bookings <bookings@mail.yourdomain.com>`.
  - Format: `Name <email@domain.com>` or plain `email@domain.com`.

If Resend rejects the from-address, the API logs a Resend error (e.g. invalid_from_address).

## Step 4: Configure the backend `.env`

```env
# Force Resend (optional: omit to use auto-detection)
MAIL_PROVIDER=resend

RESEND_API_KEY=re_xxxxxxxx

# Must match a Resend-approved sender (see Step 3)
EMAIL_FROM=Bookings <bookings@yourdomain.com>

# Public URL for links inside booking emails (confirmation + reminders)
FRONTEND_URL=http://localhost:3000
```

**Auto provider (no `MAIL_PROVIDER`):**

- If `RESEND_API_KEY` is set → **Resend**
- Else if `EMAIL_HOST` is set → **SMTP**
- Else → **no mail** (log warning; booking/auth emails are skipped or fail where applicable)

## Step 5: Restart the API

Restart `pnpm run start:dev` (or your process manager) so new env vars load.

## Step 6: Smoke test

1. Create or reschedule a court booking (logged-in user with a real email), **or** trigger login OTP / password reset.
2. Check Resend **Emails** (or the recipient inbox) for delivery.
3. If nothing arrives, check API logs for `Resend error` or `Mail provider is none`.

## Step 7: Resend deliverability test inboxes (`resend.dev`)

Resend provides built-in test recipients to simulate delivery outcomes safely:

- `delivered@resend.dev`
- `bounced@resend.dev`
- `complained@resend.dev`
- `suppressed@resend.dev`

Reference: [Resend - Send Test Emails](https://resend.com/docs/dashboard/emails/send-test-emails)

This project now includes a protected endpoint to trigger those scenarios:

`POST /notifications/test-email/resend`

Example:

```bash
curl -X POST "http://localhost:3001/notifications/test-email/resend" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "delivered",
    "label": "signup-flow",
    "subject": "Resend test from local"
  }'
```

Notes:

- Endpoint works only when provider is `resend` (`MAIL_PROVIDER=resend` or auto with `RESEND_API_KEY`).
- Label is optional and ignored for `suppressed`.
- Test endpoint uses `Booking Tennis <onboarding@resend.dev>` as sender (per Resend docs example), so it does not require your custom domain for this specific test flow.

## Related

- Gmail SMTP: [EMAIL_SETUP.md](./EMAIL_SETUP.md)
- Booking templates live under `apps/api/src/notifications/` (`mail-templates.ts`, `booking-mail.service.ts`).
