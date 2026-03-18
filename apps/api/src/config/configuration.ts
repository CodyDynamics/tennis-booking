import * as path from "path";

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
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  cookie: {
    accessTokenName: process.env.COOKIE_ACCESS_TOKEN_NAME || "access_token",
    refreshTokenName: process.env.COOKIE_REFRESH_TOKEN_NAME || "refresh_token",
    accessTokenMaxAgeSeconds: 60 * 60, // 1h, match jwt.expiresIn
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
    /** When "true" or unset: login requires OTP. When "false": normal login (email + password only, no OTP). */
    loginOtpEnabled: process.env.LOGIN_OTP_ENABLED !== "false",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:
      process.env.GOOGLE_CALLBACK_URL ||
      "http://localhost:3000/auth/google/callback",
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  },
  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    secure: process.env.EMAIL_SECURE === "true",
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || "noreply@booking-tennis.com",
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
