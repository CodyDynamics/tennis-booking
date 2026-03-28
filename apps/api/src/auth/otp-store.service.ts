import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type OtpPurpose = "login" | "register";

interface StoredOtp {
  otp: string;
  expiresAt: number;
}

@Injectable()
export class OtpStoreService {
  private readonly store = new Map<string, StoredOtp>();
  private readonly ttlSeconds: number;

  constructor(private configService: ConfigService) {
    this.ttlSeconds = this.configService.get<number>("otp.loginTtlSeconds", 300);
  }

  private key(purpose: OtpPurpose, email: string): string {
    return `${purpose}:${email.toLowerCase().trim()}`;
  }

  set(purpose: OtpPurpose, email: string, otp: string): void {
    this.store.set(this.key(purpose, email), {
      otp,
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    });
  }

  get(purpose: OtpPurpose, email: string): string | null {
    const k = this.key(purpose, email);
    const entry = this.store.get(k);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(k);
      return null;
    }
    return entry.otp;
  }

  consume(purpose: OtpPurpose, email: string, otp: string): boolean {
    const k = this.key(purpose, email);
    const stored = this.get(purpose, email);
    if (stored === null || stored !== otp) return false;
    this.store.delete(k);
    return true;
  }

  clear(purpose: OtpPurpose, email: string): void {
    this.store.delete(this.key(purpose, email));
  }
}
