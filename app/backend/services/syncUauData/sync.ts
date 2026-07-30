import type { CacheWarmer } from '../../cache/cacheWarmer.js';
import { RUNTIME } from '../../config/runtime.js';
import { NotFoundError } from '../../errors.js';
import { adminClient } from '../../gateways/supabase.js';
import { UauGateway } from '../../gateways/uau.js';
import { uauTableSchema } from '../../models/uauTable.js';
import { getSettings } from '../../settings.js';
import type { SupabaseAnyClient } from '../../types/supabase.js';
import type { UauQueryRow, UauSyncResult, UauSyncedTable, UauTable } from '../../types/uau.js';

export class UauSyncService {
  private readonly supabase: SupabaseAnyClient = adminClient();
  private readonly schema = getSettings().schema;
  private readonly batchSize = RUNTIME.sync.insertBatchSize;

  constructor(private readonly uauGateway: UauGateway, private readonly warmer?: CacheWarmer) { }

  async syncById(id: number): Promise<UauSyncResult> {
    const { data, error } = await this.supabase.from('uau_tables').select('*').eq('id_uat', id).maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError(`uau_tables sem id_uat=${id}. Rode o seed (uau_sync.sql).`);
    const result = await this.sync(uauTableSchema.parse(data));
    await this.warmer?.refreshUau();
    return result;
  }


  async syncAll(): Promise<UauSyncedTable[]> {
    const { data, error } = await this.supabase.from('uau_tables').select('*').order('id_uat');
    if (error) throw error;
    const results: UauSyncedTable[] = [];
    for (const row of data || []) {
      const uauTable = uauTableSchema.parse(row);
      const result = await this.sync(uauTable);
      results.push({ table: uauTable.supabase_uau_table_uat, rows: result.rows });
    }
    await this.warmer?.refreshUau();
    return results;
  }

  private async sync(uauTable: UauTable): Promise<UauSyncResult> {
    const records = await this.uauGateway.executeQuery(uauTable.uau_table_id_uat);
    await this.truncate(uauTable.supabase_uau_table_uat);
    await this.insertInBatches(uauTable.supabase_uau_table_uat, records);
    return { message: 'Dados sincronizados com sucesso.', rows: records.length };
  }

  private async truncate(table: string): Promise<void> {
    const { error } = await this.supabase.rpc('truncate_app_table', { schema_name: this.schema, table_name: table });
    if (error) throw error;
  }

  private async insertInBatches(table: string, data: UauQueryRow[]): Promise<void> {
    for (let index = 0; index < data.length; index += this.batchSize) {
      const { error } = await this.supabase.from(table).insert(data.slice(index, index + this.batchSize));
      if (error) throw error;
    }
  }
}
