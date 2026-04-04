import * as path from "path";

const SEND_REGISTRATION_EMAIL_OFF = new Set(["false", "0", "no", "off"]);

/**
 * Registration OTP email: enabled unless env explicitly turns it off.
 * Reads `process.env` at call time (not only via ConfigService) so Docker / .env is respected reliably.
 * Accepts: false, False, FALSE, 0, no, off (trimmed).
 */
export function isSendRegistrationEmailEnabled(): boolean {
  const v = (process.env.SEND_REGISTRATION_EMAIL ?? "").trim().toLowerCase();
  if (v === "") return true;
  return !SEND_REGISTRATION_EMAIL_OFF.has(v);
}

export default () => ({
  port: parseInt(process.env.PORT || process.env.GATEWAY_PORT || "3000", 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  DB_HOST: process.env.DB_HOST || "localhost",
  DB_PORT: process.env.DB_PORT || "5432",
  DB_USER: process.env.DB_USER || "postgres",
  DB_PASS: process.env.DB_PASS || "postgres",
  DB_NAME: process.env.DB_NAME || "booking_tennis",
  DB_LOGGING: process.env.DB_LOGGING || "false",
  jwt: {
    secret: process.env.JWT_SECRET || "your-secret-key",
    /** Short-lived access token (e.g. 15m). */
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  cookie: {
    accessTokenName: process.env.COOKIE_ACCESS_TOKEN_NAME || "access_token",
    refreshTokenName: process.env.COOKIE_REFRESH_TOKEN_NAME || "refresh_token",
    accessTokenMaxAgeSeconds: parseInt(
      process.env.COOKIE_ACCESS_MAX_AGE_SECONDS || "900",
      10,
    ), // default 15m, match JWT_EXPIRES_IN
    refreshTokenMaxAgeSeconds: 7 * 24 * 60 * 60, // 7d
    sameSite: (() => {
      const env = process.env.COOKIE_SAME_SITE as
        | "lax"
        | "strict"
        | "none"
        | undefined;
      if (env) return env;
      // Production: default SameSite=None so cookies are sent cross-origin (e.g. frontend Vercel, backend Render).
      // Set COOKIE_SAME_SITE=lax only if frontend and backend are same origin.
      if (process.env.NODE_ENV === "production") return "none";
      return "lax";
    })(),
    secure: process.env.NODE_ENV === "production",
  },
  auth: {
    /** When "true": login uses email OTP after password. Default: false (email + password only). */
    loginOtpEnabled: process.env.LOGIN_OTP_ENABLED === "true",
    /**
     * When false: registration does not send the verification email (local/Docker without SMTP).
     * Non-production: OTP is logged on the server so you can complete signup from the UI.
     */
    sendRegistrationEmail: isSendRegistrationEmailEnabled(),
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:
      process.env.GOOGLE_CALLBACK_URL ||
      "http://localhost:3000/auth/google/callback",
  },
  redis: {
    enabled: process.env.REDIS_ENABLED !== "false",
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  },
  email: {
    /** smtp | resend | cloud | none | unset (= auto: Resend if RESEND_API_KEY else SMTP if EMAIL_HOST else none) */
    provider: process.env.MAIL_PROVIDER,
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    secure: process.env.EMAIL_SECURE === "true",
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || "noreply@booking-tennis.com",
    resendApiKey: process.env.RESEND_API_KEY,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    googleSenderEmail: process.env.GOOGLE_SENDER_EMAIL,
    googleOAuthRedirectUri:
      process.env.GOOGLE_OAUTH_REDIRECT_URI ||
      "https://developers.google.com/oauthplayground",
  },
  otp: {
    /** Login OTP expiry in seconds (default 5 min) */
    loginTtlSeconds: parseInt(process.env.OTP_LOGIN_TTL_SECONDS || "300", 10),
    /** Login OTP length (digits) */
    loginLength: parseInt(process.env.OTP_LOGIN_LENGTH || "6", 10),
  },
  rsa: {
    publicKeyPath:
      process.env.RSA_PUBLIC_KEY_PATH ||
      path.join(process.cwd(), "apps", "api", "keys", "public.pem"),
    privateKeyPath:
      process.env.RSA_PRIVATE_KEY_PATH ||
      path.join(process.cwd(), "apps", "api", "keys", "private.pem"),
  },
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
});
