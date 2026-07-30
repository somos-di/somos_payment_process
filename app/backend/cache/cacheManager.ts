import type Redis from 'ioredis';
import type { CacheFetcher } from '../types/cache.js';

export class CacheManager {
  private readonly ttlSec: number;

  constructor(private readonly redis: Redis | null, ttlMs: number) {
    this.ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
  }

  get enabled(): boolean {
    return this.redis !== null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (!this.redis) return;
    try { await this.redis.set(key, JSON.stringify(value), 'EX', this.ttlSec); } catch { }
  }

  async wrap<T>(key: string, fetcher: CacheFetcher<T>): Promise<T> {
    if (this.redis) {
      try {
        const cachedJson = await this.redis.get(key);
        if (cachedJson != null) return JSON.parse(cachedJson) as T;
      } catch { }
    }

    const value = await fetcher();
    if (this.redis) {
      try { await this.redis.set(key, JSON.stringify(value), 'EX', this.ttlSec); } catch { }
    }
    return value;
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    if (!this.redis) return;
    try {
      const stream = this.redis.scanStream({ match: `${prefix}*`, count: 200 });
      const keys: string[] = [];
      for await (const batch of stream as AsyncIterable<string[]>) keys.push(...batch);
      if (keys.length) await this.redis.del(...keys);
    } catch { }
  }
}
