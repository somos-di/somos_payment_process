import type { CacheManager } from '../cache/cacheManager.js';
import { adminClient, unwrap } from '../gateways/supabase.js';
import { toMessageKindMap } from '../models/messagesKind.js';
import { toStatusCatalog } from '../models/statusKind.js';
import type { CatalogBootstrap, MessageKindMap, ProcessKindMap, ProcessKindRow, StatusCatalog } from '../types/catalog.js';

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

  messageKinds(): Promise<MessageKindMap> {
    const load = async (): Promise<MessageKindMap> => toMessageKindMap(
      await unwrap(adminClient().from('messages_kind').select('id_msk,name_msk').order('id_msk')) as unknown[],
    );
    return this.cache ? this.cache.wrap('catalog:message_kinds', load) : load();
  }

  async bootstrap(): Promise<CatalogBootstrap> {
    const [statusCatalog, processKinds, messageKinds] = await Promise.all([
      this.statusCatalog(), this.processKinds(), this.messageKinds(),
    ]);
    return { steps: statusCatalog.byId, status: statusCatalog.byKey, processKinds, messageKinds };
  }
}
