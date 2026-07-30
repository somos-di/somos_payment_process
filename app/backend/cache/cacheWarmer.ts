import { adminClient, unwrap } from '../gateways/supabase.js';
import { CACHEABLE_RESOURCES, UAU_RESOURCES, cacheKey, resourcePrefix } from './cacheableResources.js';
import type { CacheManager } from './cacheManager.js';

export class CacheWarmer {
  constructor(private readonly cache: CacheManager) { }

  private async warmResource(resource: string): Promise<void> {
    const rows = await unwrap(adminClient().from(resource).select('*'));
    await this.cache.set(cacheKey(resource, []), rows);
  }

  async warmAll(): Promise<void> {
    if (!this.cache.enabled) return;
    await Promise.all([...CACHEABLE_RESOURCES].map((resource) => this.warmResource(resource).catch(() => { })));
  }

  async refreshUau(): Promise<void> {
    if (!this.cache.enabled) return;
    await Promise.all([...UAU_RESOURCES].map(async (resource) => {
      await this.cache.invalidatePrefix(resourcePrefix(resource));
      await this.warmResource(resource).catch(() => { });
    }));
  }
}
