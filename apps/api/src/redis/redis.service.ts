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
      const withoutPrefix = key.replace("court_hold:", "");
      const courtId = withoutPrefix.split(":")[0];
      if (courtId && courtIds.includes(courtId)) {
        result[withoutPrefix] = entry.data;
      }
    }
    return result;
  }

  // ─── Slot-level holds (new flow) ─────────────────────────────────────────
  //
  // Key:   slot_hold|{locationId}|{sport}|{courtType}|{date}|{startTime}|{endTime}
  // Value: JSON array of SlotHoldEntry (one entry per socket that holds this slot).
  // Multiple holders are allowed (up to capacity, enforced by caller).
  // Uses same Redis/in-memory dual-store pattern.

  private slotHoldKey(locationId: string, sport: string, courtType: string, date: string, startTime: string, endTime: string) {
    return `slot_hold|${locationId}|${sport}|${courtType}|${date}|${startTime}|${endTime}`;
  }

  /** Add a slot hold for a socket. Returns all current holders (for caller to check capacity). */
  async addSlotHolder(
    locationId: string, sport: string, courtType: string, date: string, startTime: string, endTime: string,
    socketId: string, displayName: string, ttlSeconds = 300,
  ): Promise<SlotHoldEntry[]> {
    const key = this.slotHoldKey(locationId, sport, courtType, date, startTime, endTime);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const entry: SlotHoldEntry = { socketId, displayName, lockedAt: new Date().toISOString(), expiresAt };
    const nowMs = Date.now();

    if (this.redisReady) {
      try {
        const raw = await this.client!.get(key);
        const existing: SlotHoldEntry[] = raw ? (JSON.parse(raw) as SlotHoldEntry[]).filter(e => new Date(e.expiresAt).getTime() > nowMs) : [];
        const without = existing.filter(e => e.socketId !== socketId);
        const updated = [...without, entry];
        await this.client!.set(key, JSON.stringify(updated), "EX", ttlSeconds);
        return updated;
      } catch { /* fall through */ }
    }

    // In-memory fallback
    const memEntry = this.memHolds.get(key);
    const existing: SlotHoldEntry[] = memEntry ? (JSON.parse(JSON.stringify((memEntry.data as unknown as SlotHoldEntry[]))) as SlotHoldEntry[]).filter(e => new Date(e.expiresAt).getTime() > nowMs) : [];
    const without = existing.filter(e => e.socketId !== socketId);
    const updated = [...without, entry];
    this.memHolds.set(key, { data: updated as unknown as HoldData, expiresAtMs: nowMs + ttlSeconds * 1000 });
    return updated;
  }

  /** Remove a slot hold for a socket. Returns remaining holders. */
  async removeSlotHolder(
    locationId: string, sport: string, courtType: string, date: string, startTime: string, endTime: string,
    socketId: string,
  ): Promise<SlotHoldEntry[]> {
    const key = this.slotHoldKey(locationId, sport, courtType, date, startTime, endTime);
    const nowMs = Date.now();

    if (this.redisReady) {
      try {
        const raw = await this.client!.get(key);
        if (!raw) return [];
        const existing = (JSON.parse(raw) as SlotHoldEntry[]).filter(e => new Date(e.expiresAt).getTime() > nowMs);
        const updated = existing.filter(e => e.socketId !== socketId);
        if (updated.length === 0) { await this.client!.del(key); return []; }
        await this.client!.set(key, JSON.stringify(updated), "KEEPTTL");
        return updated;
      } catch { /* fall through */ }
    }

    const memEntry = this.memHolds.get(key);
    if (!memEntry) return [];
    const existing = (memEntry.data as unknown as SlotHoldEntry[]).filter(e => new Date(e.expiresAt).getTime() > nowMs);
    const updated = existing.filter(e => e.socketId !== socketId);
    if (updated.length === 0) { this.memHolds.delete(key); return []; }
    this.memHolds.set(key, { ...memEntry, data: updated as unknown as HoldData });
    return updated;
  }

  /** Remove ALL slot holds for a socket (on disconnect). Returns affected keys. */
  async removeAllSlotHoldsForSocket(socketId: string): Promise<string[]> {
    const released: string[] = [];
    const nowMs = Date.now();

    if (this.redisReady) {
      try {
        const keys = await this.client!.keys("slot_hold|*");
        for (const key of keys) {
          const raw = await this.client!.get(key);
          if (!raw) continue;
          const existing = (JSON.parse(raw) as SlotHoldEntry[]).filter(e => new Date(e.expiresAt).getTime() > nowMs);
          if (!existing.some(e => e.socketId === socketId)) continue;
          const updated = existing.filter(e => e.socketId !== socketId);
          if (updated.length === 0) { await this.client!.del(key); } else { await this.client!.set(key, JSON.stringify(updated), "KEEPTTL"); }
          released.push(key);
        }
        return released;
      } catch { /* fall through */ }
    }

    for (const [key, entry] of this.memHolds) {
      if (!key.startsWith("slot_hold|")) continue;
      const existing = (entry.data as unknown as SlotHoldEntry[]).filter(e => new Date(e.expiresAt).getTime() > nowMs && e.socketId !== socketId);
      const hadSocket = (entry.data as unknown as SlotHoldEntry[]).some(e => e.socketId === socketId);
      if (!hadSocket) continue;
      if (existing.length === 0) { this.memHolds.delete(key); } else { this.memHolds.set(key, { ...entry, data: existing as unknown as HoldData }); }
      released.push(key);
    }
    return released;
  }

  /**
   * Get holdCounts for all slot holds in a location.
   * Returns: Record<"sport|courtType|date|startTime|endTime", holdCount>
   */
  async getSlotHoldCounts(locationId: string): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    const nowMs = Date.now();
    const prefix = `slot_hold|${locationId}|`;

    if (this.redisReady) {
      try {
        const keys = await this.client!.keys(`${prefix}*`);
        for (const key of keys) {
          const raw = await this.client!.get(key);
          if (!raw) continue;
          const holders = (JSON.parse(raw) as SlotHoldEntry[]).filter(e => new Date(e.expiresAt).getTime() > nowMs);
          if (holders.length === 0) continue;
          const suffix = key.slice(prefix.length); // "sport|courtType|date|startTime|endTime"
          result[suffix] = holders.length;
        }
        return result;
      } catch { /* fall through */ }
    }

    for (const [key, entry] of this.memHolds) {
      if (!key.startsWith(prefix)) continue;
      const holders = (entry.data as unknown as SlotHoldEntry[]).filter(e => new Date(e.expiresAt).getTime() > nowMs);
      if (holders.length === 0) continue;
      const suffix = key.slice(prefix.length);
      result[suffix] = holders.length;
    }
    return result;
  }

  /** Force-delete a slot hold (after booking confirmed). */
  async forceDeleteSlotHold(
    locationId: string, sport: string, courtType: string, date: string, startTime: string, endTime: string,
  ): Promise<void> {
    const key = this.slotHoldKey(locationId, sport, courtType, date, startTime, endTime);
    this.memHolds.delete(key);
    if (this.redisReady) {
      try { await this.client!.del(key); } catch { /* swallow */ }
    }
  }
}

export interface HoldData {
  socketId: string;
  displayName: string;
  lockedAt: string;
  expiresAt: string;
}

export interface SlotHoldEntry {
  socketId: string;
  displayName: string;
  lockedAt: string;
  expiresAt: string;
}
