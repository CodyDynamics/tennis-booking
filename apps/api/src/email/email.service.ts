import { Injectable, Logger } from "@nestjs/common";
import { MailSenderService } from "../notifications/mail-sender.service";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailSender: MailSenderService) {}

  async sendPasswordResetEmail(to: string, resetUrl: string) {
    const ok = await this.mailSender.sendHtml({
      to,
      subject: "Password Reset Request",
      html: `
          <h2>Password Reset Request</h2>
          <p>You requested to reset your password. Click the link below to reset it:</p>
          <a href="${resetUrl}">${resetUrl}</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `,
    });
    if (ok) {
      this.logger.log(`Password reset email sent to ${to}`);
    }
    // Don't throw error to prevent revealing if email exists
  }

  async sendLoginOtpEmail(to: string, otp: string) {
    const ok = await this.mailSender.sendHtml({
      to,
      subject: "Your login verification code",
      html: `
          <h2>Login verification code</h2>
          <p>Your one-time password (OTP) for signing in is:</p>
          <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${otp}</p>
          <p>This code expires in a few minutes. Do not share it with anyone.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `,
    });
    if (ok) {
      this.logger.log(`Login OTP email sent to ${to}`);
    } else {
      this.logger.error(`Failed to send login OTP email to ${to}`);
      throw new Error("Failed to send login OTP email");
    }
  }
}
