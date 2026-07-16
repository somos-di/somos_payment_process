import type Redis from 'ioredis';

// Cache de leitura SÓ no Redis (compartilhado entre processos e reinícios).
// Fluxo do get: consulta o Redis; se houver (hit), retorna o que está lá; senão
// (miss) vai ao banco via fetcher e popula o Redis com TTL.
// Sem Redis (REDIS_URL ausente) ou com o Redis fora do ar, não há cache: cada get
// vai direto ao banco. Resiliente: qualquer falha no Redis degrada pro banco e
// nunca derruba o request.
export class CacheManager {
  private readonly ttlSec: number;

  constructor(private readonly redis: Redis | null, ttlMs: number) {
    this.ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
  }

  // true quando há Redis configurado (sem ele, não há cache
  get enabled(): boolean {
    return this.redis !== null;
  }

  // Grava/sobrescreve uma chave (usado pelo warm no boot e no refresh do sync
  async set<T>(key: string, value: T): Promise<void> {
    if (!this.redis) return;
    try { await this.redis.set(key, JSON.stringify(value), 'EX', this.ttlSec); } catch { /* ignore */ }
  }

  // Lê do Redis ou computa via fetcher e popula o Redis.
  async wrap<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (this.redis) {
      try {
        const json = await this.redis.get(key);
        if (json != null) return JSON.parse(json) as T;
      } catch { /* Redis indisponível: cai pro banco */ }
    }

    const value = await fetcher();
    if (this.redis) {
      try { await this.redis.set(key, JSON.stringify(value), 'EX', this.ttlSec); } catch { /* ignore */ }
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
    } catch { /* ignore */ }
  }
}
