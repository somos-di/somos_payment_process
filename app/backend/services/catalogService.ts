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

  processKinds(): Promise<Record<number, string>> {
    const load = async (): Promise<Record<number, string>> => {
      const rows = await unwrap(
        adminClient().from('process_kinds').select('id_pkn,name_pkn').order('name_pkn'),
      ) as Array<{ id_pkn: number; name_pkn: string }>;
      const m: Record<number, string> = {};
      for (const r of rows) m[r.id_pkn] = r.name_pkn;
      return m;
    };
    return this.cache ? this.cache.wrap('catalog:process_kinds', load) : load();
  }

  async bootstrap(): Promise<{
    steps: Record<number, string>;
    status: Record<string, number>;
    processKinds: Record<number, string>;
  }> {
    const [cat, processKinds] = await Promise.all([this.statusCatalog(), this.processKinds()]);
    return { steps: cat.byId, status: cat.byKey, processKinds };
  }
}
