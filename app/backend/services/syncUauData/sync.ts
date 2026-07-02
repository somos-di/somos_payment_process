import type { SupabaseClient } from '@supabase/supabase-js';
import type { CacheWarmer } from '../../cache/cacheWarmer.js';
import { RUNTIME } from '../../config/runtime.js';
import { NotFoundError } from '../../errors.js';
import { adminClient } from '../../gateways/supabase.js';
import { UauGateway } from '../../gateways/uau.js';
import { uauTableSchema, type UauTable } from '../../models/uauTable.js';
import { getSettings } from '../../settings.js';

// Mesmo método do referência: lê o catálogo uau_tables, puxa do UAU (executeQuery),
// trunca a tabela-espelho e reinsere em lote. Usa service_role (privilegiado).
export class UauSyncService {
  private readonly sb: SupabaseClient = adminClient();
  private readonly schema = getSettings().schema;
  private readonly batchSize = RUNTIME.sync.insertBatchSize;

  constructor(private readonly uau: UauGateway, private readonly warmer?: CacheWarmer) { }

  async syncById(id: number): Promise<{ message: string; rows: number }> {
    const { data, error } = await this.sb.from('uau_tables').select('*').eq('id_uat', id).maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError(`uau_tables sem id_uat=${id}. Rode o seed (uau_sync.sql).`);
    const r = await this.sync(uauTableSchema.parse(data));
    await this.warmer?.refreshUau(); // espelhos mudaram -> invalida + re-aquece só os recursos UAU
    return r;
  }


  async syncAll(): Promise<Array<{ table: string; rows: number }>> {
    const { data, error } = await this.sb.from('uau_tables').select('*').order('id_uat');
    if (error) throw error;
    const out: Array<{ table: string; rows: number }> = [];
    for (const row of data || []) {
      const t = uauTableSchema.parse(row);
      const r = await this.sync(t);
      out.push({ table: t.supabase_uau_table_uat, rows: r.rows });
    }
    await this.warmer?.refreshUau(); // espelhos reescritos -> invalida + re-aquece só os recursos UAU
    return out;
  }

  private async sync(t: UauTable): Promise<{ message: string; rows: number }> {
    const records = await this.uau.executeQuery(t.uau_table_id_uat);
    await this.truncate(t.supabase_uau_table_uat);
    await this.insertInBatches(t.supabase_uau_table_uat, records);
    return { message: 'Dados sincronizados com sucesso.', rows: records.length };
  }

  private async truncate(table: string): Promise<void> {
    const { error } = await this.sb.rpc('truncate_app_table', { schema_name: this.schema, table_name: table });
    if (error) throw error;
  }

  private async insertInBatches(table: string, data: Record<string, unknown>[]): Promise<void> {
    for (let i = 0; i < data.length; i += this.batchSize) {
      const { error } = await this.sb.from(table).insert(data.slice(i, i + this.batchSize));
      if (error) throw error;
    }
  }
}
