import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { Resend } from "resend";
import { google } from "googleapis";
import { renderMailLayout } from "./mail-layout";

export type MailTransportKind = "smtp" | "resend" | "cloud" | "none";
export type ResendTestScenario =
  | "delivered"
  | "bounced"
  | "complained"
  | "suppressed";

export interface SendHtmlMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

/** Dynamic transactional mail using the shared layout (title / body / footer slots). */
export interface SendLayoutMailOptions {
  to: string | string[];
  subject: string;
  /** Shown as the main heading and document title (escape user text via `escapeHtml` from `mail-layout`). */
  title: string;
  /** Inner HTML for the body region (trusted or pre-escaped). */
  bodyHtml: string;
  footerHtml?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface SendResendTestMailOptions {
  scenario: ResendTestScenario;
  /**
   * Optional label for resend.dev addresses, e.g. delivered+signup@resend.dev.
   * Not supported by "suppressed" scenario.
   */
  label?: string;
  subject?: string;
  html?: string;
}

function resolveProvider(
  explicit: string | undefined,
  hasResendKey: boolean,
  hasSmtpHost: boolean,
): MailTransportKind {
  const p = (explicit || "").toLowerCase().trim();
  if (p === "none") return "none";
  if (p === "resend") return "resend";
  if (p === "smtp") return "smtp";
  if (p === "cloud") return "cloud";
  // auto
  if (hasResendKey) return "resend";
  if (hasSmtpHost) return "smtp";
  return "none";
}

@Injectable()
export class MailSenderService {
  private readonly logger = new Logger(MailSenderService.name);
  private smtpTransporter: nodemailer.Transporter | null = null;
  private resendClient: Resend | null = null;
  private gmailClient: ReturnType<typeof google.gmail> | null = null;
  private readonly provider: MailTransportKind;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const resendKey = this.config.get<string>("email.resendApiKey");
    const smtpHost = this.config.get<string>("email.host");
    this.provider = resolveProvider(
      this.config.get<string>("email.provider"),
      Boolean(resendKey?.trim()),
      Boolean(smtpHost?.trim()),
    );
    this.from =
      this.config.get<string>("email.from") || "noreply@booking-tennis.com";
    if (this.provider === "none") {
      this.logger.warn(
        "Mail provider is none (set RESEND_API_KEY or SMTP EMAIL_HOST, or MAIL_PROVIDER). Outbound mail is disabled.",
      );
    } else {
      this.logger.log(`Mail provider: ${this.provider}`);
    }
  }

  getProvider(): MailTransportKind {
    return this.provider;
  }

  private getSmtpTransporter(): nodemailer.Transporter {
    if (!this.smtpTransporter) {
      this.smtpTransporter = nodemailer.createTransport({
        host: this.config.get<string>("email.host"),
        port: this.config.get<number>("email.port"),
        secure: this.config.get<boolean>("email.secure"),
        auth: {
          user: this.config.get<string>("email.user"),
          pass: this.config.get<string>("email.password"),
        },
        connectionTimeout: 15_000,
        greetingTimeout: 10_000,
      });
    }
    return this.smtpTransporter;
  }

  private getResend(): Resend {
    if (!this.resendClient) {
      const key = this.config.get<string>("email.resendApiKey");
      if (!key?.trim()) {
        throw new Error("RESEND_API_KEY is not set");
      }
      this.resendClient = new Resend(key);
    }
    return this.resendClient;
  }

  private getCloudGmail() {
    if (!this.gmailClient) {
      const clientId = this.config.get<string>("email.googleClientId");
      const clientSecret = this.config.get<string>("email.googleClientSecret");
      const refreshToken = this.config.get<string>("email.googleRefreshToken");
      const redirectUri = this.config.get<string>("email.googleOAuthRedirectUri");
      if (!clientId?.trim() || !clientSecret?.trim() || !refreshToken?.trim()) {
        throw new Error(
          "Cloud mail provider missing config: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN",
        );
      }
      const auth = new google.auth.OAuth2({
        clientId,
        clientSecret,
        redirectUri,
      });
      auth.setCredentials({ refresh_token: refreshToken });
      this.gmailClient = google.gmail({ version: "v1", auth });
    }
    return this.gmailClient;
  }

  private buildGmailRawMessage(options: SendHtmlMailOptions): string {
    const from = options.from || this.from;
    const to = Array.isArray(options.to) ? options.to.join(", ") : options.to;
    const replyTo = options.replyTo?.trim();
    const text = options.text || "";
    const boundary = `bt-${Date.now().toString(16)}`;
    const lines = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${options.subject}`,
      "MIME-Version: 1.0",
      ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      text,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "",
      options.html,
      `--${boundary}--`,
      "",
    ];
    return Buffer.from(lines.join("\r\n"), "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  /**
   * Send HTML email. Does not throw for SMTP/Resend failures when called from
   * fire-and-forget paths; logs and returns. Callers that need errors can check return value.
   */
  async sendHtml(
    options: SendHtmlMailOptions & { throwOnFailure?: boolean },
  ): Promise<boolean> {
    if (this.provider === "none") {
      this.logger.debug(
        `Skipping send (provider none): subject=${options.subject}`,
      );
      if (options.throwOnFailure) {
        throw new Error(
          "Mail provider is none: set RESEND_API_KEY, SMTP (EMAIL_HOST), or MAIL_PROVIDER=cloud with Google tokens.",
        );
      }
      return false;
    }
    const to = Array.isArray(options.to) ? options.to : [options.to];
    const { throwOnFailure, ...mailOptions } = options;
    try {
      if (this.provider === "resend") {
        const resend = this.getResend();
        const { error } = await resend.emails.send({
          from: mailOptions.from || this.from,
          to,
          subject: mailOptions.subject,
          html: mailOptions.html,
          text: mailOptions.text,
          replyTo: mailOptions.replyTo,
        });
        if (error) {
          this.logger.error(
            `Resend error: ${error.message}`,
            (error as { name?: string }).name,
          );
          return false;
        }
      } else if (this.provider === "cloud") {
        const gmail = this.getCloudGmail();
        const sender = this.config.get<string>("email.googleSenderEmail")?.trim();
        const raw = this.buildGmailRawMessage(mailOptions);
        await gmail.users.messages.send({
          userId: sender || "me",
          requestBody: { raw },
        });
      } else {
        await this.getSmtpTransporter().sendMail({
          from: mailOptions.from || this.from,
          to: to.join(", "),
          subject: mailOptions.subject,
          html: mailOptions.html,
          text: mailOptions.text,
          replyTo: mailOptions.replyTo,
        });
      }
      this.logger.log(`Mail sent: "${mailOptions.subject}" → ${to.join(", ")}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to send mail: ${mailOptions.subject}`, err);
      if (throwOnFailure) {
        if (err instanceof Error) throw err;
        throw new Error(String(err));
      }
      return false;
    }
  }

  /** Wrap `bodyHtml` + optional `footerHtml` in the standard email shell, then send. */
  async sendLayoutEmail(options: SendLayoutMailOptions): Promise<boolean> {
    const html = renderMailLayout({
      title: options.title,
      bodyHtml: options.bodyHtml,
      footerHtml: options.footerHtml,
    });
    return this.sendHtml({
      to: options.to,
      subject: options.subject,
      html,
      text: options.text,
      from: options.from,
      replyTo: options.replyTo,
    });
  }

  private buildResendTestAddress(
    scenario: ResendTestScenario,
    label?: string,
  ): string {
    const cleanLabel = (label || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "");
    if (scenario === "suppressed" || !cleanLabel) {
      return `${scenario}@resend.dev`;
    }
    return `${scenario}+${cleanLabel}@resend.dev`;
  }

  async sendResendTestEmail(options: SendResendTestMailOptions): Promise<{
    ok: boolean;
    to: string;
    reason?: string;
  }> {
    if (this.provider !== "resend") {
      return {
        ok: false,
        to: "",
        reason: "MAIL_PROVIDER is not resend",
      };
    }

    const to = this.buildResendTestAddress(options.scenario, options.label);
    const ok = await this.sendLayoutEmail({
      to,
      subject: options.subject || `[Resend test] ${options.scenario}`,
      title: "Resend Deliverability Test",
      bodyHtml:
        options.html ||
        `<p>Scenario: <strong>${options.scenario}</strong></p><p>Generated by Booking Tennis API test endpoint.</p>`,
      footerHtml:
        "This email is sent to resend.dev test inbox for deliverability simulation.",
      text: `Resend test scenario: ${options.scenario}`,
      // Official Resend test sender from docs for non-verified-domain development.
      from: "Booking Tennis <onboarding@resend.dev>",
      replyTo: "onboarding@resend.dev",
    });
    return { ok, to };
  }
}
