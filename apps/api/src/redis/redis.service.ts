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
    const enabled = this.configService.get<boolean>("redis.enabled", true);
    if (!enabled) {
      this.logger.warn("Redis disabled (REDIS_ENABLED=false); AT blacklist skipped");
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
}
