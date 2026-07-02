import { adminClient, unwrap } from '../gateways/supabase.js';
import { CACHEABLE_RESOURCES, UAU_RESOURCES, cacheKey, resourcePrefix } from './cacheableResources.js';
import type { CacheManager } from './cacheManager.js';

// Aquece o cache do servidor. Os recursos cacheáveis são GLOBAIS (mesmo resultado
// para qualquer usuário: espelhos UAU + lookups, com RLS `using(true)`), então o
// warm lê via service_role — o valor é idêntico ao que o userClient traria.
// Popula a consulta "base" (sem filtros) de cada recurso, que é o caso quente.
export class CacheWarmer {
  constructor(private readonly cache: CacheManager) { }

  private async warmResource(resource: string): Promise<void> {
    const rows = await unwrap(adminClient().from(resource).select('*'));
    await this.cache.set(cacheKey(resource, []), rows);
  }

  // Boot: aquece TODOS os recursos cacheáveis. Resiliente por recurso (um que falhe
  // não derruba os outros nem o boot).
  async warmAll(): Promise<void> {
    if (!this.cache.enabled) return;
    await Promise.all([...CACHEABLE_RESOURCES].map((r) => this.warmResource(r).catch(() => { })));
  }

  // Sync UAU: invalida TODAS as variantes dos recursos UAU (filtros incluídos) e
  // re-aquece a base com o dado fresco. Não toca nos recursos não-UAU.
  async refreshUau(): Promise<void> {
    if (!this.cache.enabled) return;
    await Promise.all([...UAU_RESOURCES].map(async (r) => {
      await this.cache.invalidatePrefix(resourcePrefix(r));
      await this.warmResource(r).catch(() => { });
    }));
  }
}
