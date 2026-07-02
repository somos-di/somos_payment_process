import type { CacheManager } from '../cache/cacheManager.js';
import { adminClient, unwrap } from '../gateways/supabase.js';
import { toStatusCatalog, type StatusCatalog } from '../models/statusKind.js';

// Catálogos de domínio: o backend LÊ do banco, DESSERIALIZA (serializer Zod) e
// CACHEIA a forma normalizada (Redis). O front consome pronto, sem parse.
export class CatalogService {
  constructor(private readonly cache?: CacheManager) { }

  statusCatalog(): Promise<StatusCatalog> {
    const load = async (): Promise<StatusCatalog> => toStatusCatalog(
      await unwrap(adminClient().from('status_kind').select('id_skn,descr_skn,key_skn').order('id_skn')) as unknown[],
    );
    // catálogo global (igual p/ todos): cacheável sem chave de usuário.
    return this.cache ? this.cache.wrap('catalog:status', load) : load();
  }
}
