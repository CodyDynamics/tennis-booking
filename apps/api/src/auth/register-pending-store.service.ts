import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface PendingRegisterPayload {
  passwordHash: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  homeAddress: string | null;
  expiresAt: number;
}

@Injectable()
export class RegisterPendingStoreService {
  private readonly store = new Map<string, PendingRegisterPayload>();
  private readonly ttlMs: number;

  constructor(private configService: ConfigService) {
    const ttlSeconds = this.configService.get<number>("otp.loginTtlSeconds", 300);
    this.ttlMs = ttlSeconds * 1000;
  }

  private normEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  set(email: string, payload: Omit<PendingRegisterPayload, "expiresAt">): void {
    const key = this.normEmail(email);
    this.store.set(key, {
      ...payload,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  get(email: string): PendingRegisterPayload | null {
    const key = this.normEmail(email);
    const row = this.store.get(key);
    if (!row) return null;
    if (Date.now() > row.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return row;
  }

  delete(email: string): void {
    this.store.delete(this.normEmail(email));
  }
}
