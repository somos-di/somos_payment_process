// Cache em memória genérico com TTL único (L1 in-process). Portado do projeto de
// referência. Node single-thread por worker: get/set/delete são atômicos.
export class Memo<K, V> {
  private readonly store = new Map<K, { value: V; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: K): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
