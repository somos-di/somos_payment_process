import type Redis from 'ioredis';
import { Memo } from './memo.js';

// Cache de leitura em 2 camadas:
//   L1 = Memo in-process (evita round-trip + JSON.parse no caminho quente)
//   L2 = Redis (compartilhado entre reinícios; opcional — null => só L1)
// Resiliente: qualquer falha no Redis degrada pra L1, nunca derruba o request.
//
// Limitação consciente: single-process. Com múltiplos workers, o L1 de cada um
// pode divergir após um invalidate em outro worker até o TTL expirar — aí
// entraria um pub/sub (crossProcessCacheManager da referência). Hoje rodamos
// 1 container/1 processo, então não compensa.
export class CacheManager {
  private readonly l1: Memo<string, unknown>;
  private readonly ttlSec: number;

  constructor(private readonly redis: Redis | null, ttlMs: number) {
    this.l1 = new Memo<string, unknown>(ttlMs);
    this.ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
  }

  get enabledL2(): boolean {
    return this.redis !== null;
  }

  // Lê do cache (L1 -> L2) ou computa via fetcher e popula as duas camadas.
  async wrap<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const hit = this.l1.get(key);
    if (hit !== undefined) return hit as T;

    if (this.redis) {
      try {
        const json = await this.redis.get(key);
        if (json != null) {
          const value = JSON.parse(json) as T;
          this.l1.set(key, value);
          return value;
        }
      } catch { /* degrada pra fetcher */ }
    }

    const value = await fetcher();
    this.l1.set(key, value);
    if (this.redis) {
      try { await this.redis.set(key, JSON.stringify(value), 'EX', this.ttlSec); } catch { /* ignore */ }
    }
    return value;
  }

  // Invalida tudo que começa com `prefix`. Chamado no sync UAU. L1 é zerado
  // por inteiro (operação rara; repopula lazy); no Redis usa SCAN + DEL.
  async invalidatePrefix(prefix: string): Promise<void> {
    this.l1.clear();
    if (!this.redis) return;
    try {
      const stream = this.redis.scanStream({ match: `${prefix}*`, count: 200 });
      const keys: string[] = [];
      for await (const batch of stream as AsyncIterable<string[]>) keys.push(...batch);
      if (keys.length) await this.redis.del(...keys);
    } catch { /* ignore */ }
  }
}
