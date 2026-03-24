import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

const BLACKLIST_PREFIX = "auth:at:blacklist:";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.startMemHoldSweep();
    const enabled = this.configService.get<boolean>("redis.enabled", true);
    if (!enabled) {
      this.logger.warn("Redis disabled (REDIS_ENABLED=false); AT blacklist + hold using in-memory fallback");
      return;
    }
    const host = this.configService.get<string>("redis.host", "localhost");
    const port = this.configService.get<number>("redis.port", 6379);
    try {
      this.client = new Redis({
        host,
        port,
        maxRetriesPerRequest: 2,
        retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
        lazyConnect: true,
      });
      this.client.on("error", (err) =>
        this.logger.warn(`Redis error: ${err.message}`),
      );
      await this.client.connect();
      this.logger.log(`Redis connected at ${host}:${port}`);
    } catch (e) {
      this.logger.warn(
        `Redis unavailable; access-token blacklist disabled: ${e instanceof Error ? e.message : String(e)}`,
      );
      if (this.client) {
        this.client.disconnect();
        this.client = null;
      }
    }
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  isAvailable(): boolean {
    return this.client?.status === "ready";
  }

  /** Blacklist access token jti until original exp (seconds TTL). */
  async blacklistAccessTokenJti(jti: string, ttlSeconds: number): Promise<void> {
    if (!this.client || ttlSeconds <= 0) return;
    try {
      await this.client.set(
        `${BLACKLIST_PREFIX}${jti}`,
        "1",
        "EX",
        ttlSeconds,
      );
    } catch (e) {
      this.logger.warn(
        `Redis blacklist set failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async isAccessTokenJtiBlacklisted(jti: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const v = await this.client.get(`${BLACKLIST_PREFIX}${jti}`);
      return v === "1";
    } catch {
      return false;
    }
  }

  // ─── Court soft-lock (hold) ───────────────────────────────────────────────
  //
  // Uses Redis when available; falls back to an in-process Map so the feature
  // works even when Redis is not running (development without Redis).
  // In-memory entries carry their own expiresAt timestamp; a periodic sweep
  // removes them so the Map doesn't grow indefinitely.

  /** in-memory fallback store: holdKey → { data, expiresAt (ms epoch) } */
  private readonly memHolds = new Map<string, { data: HoldData; expiresAtMs: number }>();

  private startMemHoldSweep() {
    setInterval(() => {
      const now = Date.now();
      for (const [k, v] of this.memHolds) {
        if (v.expiresAtMs <= now) this.memHolds.delete(k);
      }
    }, 30_000); // sweep every 30 s
  }

  /** true when Redis is connected and ready */
  private get redisReady() {
    return this.client?.status === "ready";
  }

  private holdKey(courtId: string, date: string, startTime: string, endTime: string) {
    return `court_hold:${courtId}:${date}:${startTime}:${endTime}`;
  }

  /** Try to acquire a hold. Returns true on success, false if already held. */
  async acquireHold(
    courtId: string,
    date: string,
    startTime: string,
    endTime: string,
    socketId: string,
    displayName: string,
    ttlSeconds = 300,
  ): Promise<boolean> {
    const key = this.holdKey(courtId, date, startTime, endTime);
    const value: HoldData = {
      socketId,
      displayName,
      lockedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };

    if (this.redisReady) {
      try {
        const result = await this.client!.set(key, JSON.stringify(value), "EX", ttlSeconds, "NX");
        return result === "OK";
      } catch {
        // fall through to in-memory
      }
    }

    // In-memory fallback (atomic for single-process; fine for dev)
    const existing = this.memHolds.get(key);
    if (existing && existing.expiresAtMs > Date.now()) return false; // held by someone else
    this.memHolds.set(key, { data: value, expiresAtMs: Date.now() + ttlSeconds * 1000 });
    return true;
  }

  /** Release a hold only if it belongs to the given socketId. */
  async releaseHold(
    courtId: string,
    date: string,
    startTime: string,
    endTime: string,
    socketId: string,
  ): Promise<boolean> {
    const key = this.holdKey(courtId, date, startTime, endTime);

    if (this.redisReady) {
      try {
        const raw = await this.client!.get(key);
        if (!raw) { this.memHolds.delete(key); return false; }
        const data = JSON.parse(raw) as HoldData;
        if (data.socketId !== socketId) return false;
        await this.client!.del(key);
        return true;
      } catch { /* fall through */ }
    }

    const entry = this.memHolds.get(key);
    if (!entry || entry.data.socketId !== socketId) return false;
    this.memHolds.delete(key);
    return true;
  }

  /** Release ALL holds owned by a given socketId (called on socket disconnect). */
  async releaseAllHoldsForSocket(socketId: string): Promise<string[]> {
    const released: string[] = [];

    if (this.redisReady) {
      try {
        const keys = await this.client!.keys("court_hold:*");
        for (const key of keys) {
          const raw = await this.client!.get(key);
          if (!raw) continue;
          const data = JSON.parse(raw) as HoldData;
          if (data.socketId === socketId) {
            await this.client!.del(key);
            released.push(key);
          }
        }
        return released;
      } catch { /* fall through to also clean mem store */ }
    }

    for (const [key, entry] of this.memHolds) {
      if (entry.data.socketId === socketId) {
        this.memHolds.delete(key);
        released.push(key);
      }
    }
    return released;
  }

  /** Force-delete a hold regardless of owner (called after a booking is confirmed). */
  async forceDeleteHold(
    courtId: string,
    date: string,
    startTime: string,
    endTime: string,
  ): Promise<void> {
    const key = this.holdKey(courtId, date, startTime, endTime);
    this.memHolds.delete(key);
    if (this.redisReady) {
      try { await this.client!.del(key); } catch { /* swallow */ }
    }
  }

  /** Get all active holds for the given court IDs. */
  async getHoldsByLocation(_locationId: string, courtIds: string[]): Promise<Record<string, HoldData>> {
    const result: Record<string, HoldData> = {};
    const now = Date.now();

    if (this.redisReady) {
      try {
        for (const courtId of courtIds) {
          const keys = await this.client!.keys(`court_hold:${courtId}:*`);
          for (const key of keys) {
            const raw = await this.client!.get(key);
            if (!raw) continue;
            const data = JSON.parse(raw) as HoldData;
            result[key.replace("court_hold:", "")] = data;
          }
        }
        return result;
      } catch { /* fall through */ }
    }

    // In-memory fallback
    for (const [key, entry] of this.memHolds) {
      if (entry.expiresAtMs <= now) continue;
      // key: court_hold:{courtId}:{date}:{startTime}:{endTime}
      const withoutPrefix = key.replace("court_hold:", "");
      const courtId = withoutPrefix.split(":")[0];
      if (courtId && courtIds.includes(courtId)) {
        result[withoutPrefix] = entry.data;
      }
    }
    return result;
  }
}

export interface HoldData {
  socketId: string;
  displayName: string;
  lockedAt: string;
  expiresAt: string;
}

export interface HoldData {
  socketId: string;
  displayName: string;
  lockedAt: string;
  expiresAt: string;
}
