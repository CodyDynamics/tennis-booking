import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>("email.host"),
      port: this.configService.get<number>("email.port"),
      secure: this.configService.get<boolean>("email.secure"),
      auth: {
        user: this.configService.get<string>("email.user"),
        pass: this.configService.get<string>("email.password"),
      },
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string) {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>("email.from"),
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
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
      // Don't throw error to prevent revealing if email exists
    }
  }
}
