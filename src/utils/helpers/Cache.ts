import redis from "../../config/redis.js";
import crypto from "crypto";

export class Cache {
  static DEFAULT_TTL = 30;

  static hash(data: unknown): string {
    return crypto.createHash("md5").update(JSON.stringify(data)).digest("hex");
  }

  static async get<T>(key: string): Promise<T | null> {
    const raw = await redis.get(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  static async set<T>(
    key: string,
    value: T,
    ttl: number = Cache.DEFAULT_TTL
  ): Promise<void> {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
  }

  static async delete(key: string): Promise<void> {
    await redis.del(key);
  }

  static async clearPrefix(prefix: string): Promise<void> {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  }
}
