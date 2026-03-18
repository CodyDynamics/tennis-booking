import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

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

  set(email: string, otp: string): void {
    const key = email.toLowerCase().trim();
    this.store.set(key, {
      otp,
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    });
  }

  get(email: string): string | null {
    const key = email.toLowerCase().trim();
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.otp;
  }

  consume(email: string, otp: string): boolean {
    const key = email.toLowerCase().trim();
    const stored = this.get(email);
    if (stored === null || stored !== otp) return false;
    this.store.delete(key);
    return true;
  }
}
