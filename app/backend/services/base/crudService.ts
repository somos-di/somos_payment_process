import type { SupabaseClient } from '@supabase/supabase-js';

// CRUD genérico. O client já vem com o schema configurado (db.schema='payment').
// Recebe o client por chamada para suportar RLS por usuário (userClient(token)).
export abstract class CrudService<TRow, TInsert, TUpdate> {
  protected abstract readonly tableName: string;
  protected abstract readonly idColumn: string;

  protected table(client: SupabaseClient) {
    return client.from(this.tableName);
  }

  async insertOne(client: SupabaseClient, record: TInsert): Promise<TRow> {
    const { data, error } = await this.table(client).insert(record as Record<string, unknown>).select().single();
    if (error) throw error;
    return data as TRow;
  }
  async updateOne(client: SupabaseClient, id: string | number, updates: TUpdate): Promise<TRow> {
    const { data, error } = await this.table(client).update(updates as Record<string, unknown>).eq(this.idColumn, id).select().single();
    if (error) throw error;
    return data as TRow;
  }
  async readOne(client: SupabaseClient, id: string | number): Promise<TRow | null> {
    const { data, error } = await this.table(client).select('*').eq(this.idColumn, id).maybeSingle();
    if (error) throw error;
    return data as TRow | null;
  }
  async readMany(client: SupabaseClient, filters?: Record<string, unknown>): Promise<TRow[]> {
    let q = this.table(client).select('*');
    if (filters) for (const [k, v] of Object.entries(filters)) { if (v !== undefined && v !== null && v !== '') q = q.eq(k, v); }
    const { data, error } = await q;
    if (error) throw error;
    return data as TRow[];
  }
}
