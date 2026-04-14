import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    this.client.on("error", (err) => this.logger.warn(`Redis error: ${err.message}`));
    this.client.connect().catch((err) => this.logger.warn(`Redis connect failed: ${err.message}`));
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => {});
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      // cache write failure is non-critical
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch {
      // ignore
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    try {
      let cursor = "0";
      do {
        const [next, keys] = await this.client.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = next;
        if (keys.length > 0) await this.client.del(...keys);
      } while (cursor !== "0");
    } catch {
      // ignore
    }
  }
}
