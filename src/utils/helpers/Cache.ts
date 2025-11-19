import redis from "../../config/redis.js";
import crypto from "crypto";

export class Cache {
  static DEFAULT_TTL = 900; // 15 minutes

  static hash(data: unknown): string {
    return crypto.createHash("md5").update(JSON.stringify(data)).digest("hex");
  }

  static async get<T>(key: string): Promise<T | null> {
    if (!redis) return null; // cache disabled
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  static async set<T>(key: string, value: T, ttl: number = Cache.DEFAULT_TTL) {
    if (!redis) return; // cache disabled
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttl);
    } catch {}
  }

  static async delete(key: string) {
    if (!redis) return;
    try {
      await redis.del(key);
    } catch {}
  }

  static async clearPrefix(prefix: string) {
    if (!redis) return;
    try {
      const keys = await redis.keys(`${prefix}*`);
      if (keys.length > 0) await redis.del(keys);
    } catch {}
  }
}
