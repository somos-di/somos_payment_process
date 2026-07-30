import type { CacheManager } from '../cache/cacheManager.js';
import { adminClient, unwrap } from '../gateways/supabase.js';
import { toStatusCatalog } from '../models/statusKind.js';
import type { CatalogBootstrap, ProcessKindMap, ProcessKindRow, StatusCatalog } from '../types/catalog.js';

export class CatalogService {
  constructor(private readonly cache?: CacheManager) { }

  statusCatalog(): Promise<StatusCatalog> {
    const load = async (): Promise<StatusCatalog> => toStatusCatalog(
      await unwrap(adminClient().from('status_kind').select('id_skn,descr_skn,key_skn').order('id_skn')) as unknown[],
    );
    return this.cache ? this.cache.wrap('catalog:status', load) : load();
  }

  processKinds(): Promise<ProcessKindMap> {
    const load = async (): Promise<ProcessKindMap> => {
      const rows = await unwrap(
        adminClient().from('process_kinds').select('id_pkn,name_pkn').order('name_pkn'),
      ) as ProcessKindRow[];
      const namesById: ProcessKindMap = {};
      for (const row of rows) namesById[row.id_pkn] = row.name_pkn;
      return namesById;
    };
    return this.cache ? this.cache.wrap('catalog:process_kinds', load) : load();
  }

  async bootstrap(): Promise<CatalogBootstrap> {
    const [statusCatalog, processKinds] = await Promise.all([this.statusCatalog(), this.processKinds()]);
    return { steps: statusCatalog.byId, status: statusCatalog.byKey, processKinds };
  }
}
