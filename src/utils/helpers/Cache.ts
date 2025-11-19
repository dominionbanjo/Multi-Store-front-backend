import redis from "../../config/redis.js";
import crypto from "crypto";

export class Cache {
  static DEFAULT_TTL = 30; // seconds

  /** Create a stable hashed key from any object */
  static hash(data: unknown): string {
    return crypto.createHash("md5").update(JSON.stringify(data)).digest("hex");
  }

  /** Retrieve cached value (auto JSON parse) */
  static async get<T = any>(key: string): Promise<T | null> {
    const raw = await redis.get(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  /** Store value in cache with TTL (default 30s) */
  static async set(
    key: string,
    value: any,
    ttl: number = Cache.DEFAULT_TTL
  ): Promise<void> {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
  }

  /** Delete one cache key */
  static async delete(key: string): Promise<void> {
    await redis.del(key);
  }

  /**
   * Delete multiple keys matching a prefix
   * Example: `Cache.clearPrefix("cache:users:list")`
   */
  static async clearPrefix(prefix: string): Promise<void> {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  }
}
