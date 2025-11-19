import { Cache } from "./Cache.js";

export class ServiceCache {
  /** Build stable cache keys */
  static key(
    domain: string,
    action: string,
    identifier?: string | object
  ): string {
    const hash = identifier ? Cache.hash(identifier) : "";
    return `svc:${domain}:${action}:${hash}`;
  }

  static async get<T>(key: string): Promise<T | null> {
    return Cache.get<T>(key);
  }

  static async set<T>(key: string, value: T, ttl = 60): Promise<void> {
    await Cache.set(key, value, ttl);
  }

  static async clear(prefix: string): Promise<void> {
    await Cache.clearPrefix(prefix);
  }
}
