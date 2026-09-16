import { adminClient } from '../../gateways/supabase.js';

export interface SyncMaster {
  enabled_syc: boolean;
  updated_at_syc: string;
}

export interface SyncTable {
  id_uat: number;
  uau_table_uat: string;
  supabase_uau_table_uat: string;
  uau_table_id_uat: number;
  auto_enabled_uat: boolean;
  interval_minutes_uat: number;
  last_sync_at_uat: string | null;
  last_status_uat: string | null;
  last_rows_uat: number | null;
  last_error_uat: string | null;
  last_duration_ms_uat: number | null;
}

export interface SyncRunOutcome {
  status: 'ok' | 'error';
  rows?: number;
  durationMs: number;
  error?: string;
}

const TABLE_COLUMNS = 'id_uat, uau_table_uat, supabase_uau_table_uat, uau_table_id_uat, auto_enabled_uat, interval_minutes_uat, last_sync_at_uat, last_status_uat, last_rows_uat, last_error_uat, last_duration_ms_uat';

export async function getMaster(): Promise<SyncMaster> {
  const existing = await adminClient().from('sync_config').select('enabled_syc, updated_at_syc').eq('id_syc', 1).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as SyncMaster;
  const created = await adminClient().from('sync_config').upsert({ id_syc: 1 }, { onConflict: 'id_syc' }).select('enabled_syc, updated_at_syc').single();
  if (created.error) throw created.error;
  return created.data as SyncMaster;
}

export async function setMaster(enabled: boolean): Promise<SyncMaster> {
  const { data, error } = await adminClient().from('sync_config')
    .update({ enabled_syc: !!enabled, updated_at_syc: new Date().toISOString() }).eq('id_syc', 1)
    .select('enabled_syc, updated_at_syc').single();
  if (error) throw error;
  return data as SyncMaster;
}

export async function getSyncTables(): Promise<SyncTable[]> {
  const { data, error } = await adminClient().from('uau_tables').select(TABLE_COLUMNS).neq('id_uat', -999).order('id_uat');
  if (error) throw error;
  return (data || []) as SyncTable[];
}

export async function setSyncTables(items: { id: number; auto_enabled?: boolean; interval_minutes?: number }[]): Promise<SyncTable[]> {
  for (const item of items) {
    const update: Record<string, unknown> = {};
    if (item.auto_enabled != null) update.auto_enabled_uat = !!item.auto_enabled;
    if (item.interval_minutes != null) update.interval_minutes_uat = Math.max(1, Math.floor(item.interval_minutes));
    if (Object.keys(update).length === 0) continue;
    const { error } = await adminClient().from('uau_tables').update(update).eq('id_uat', item.id);
    if (error) throw error;
  }
  return getSyncTables();
}

export async function recordTableRun(id: number, outcome: SyncRunOutcome): Promise<void> {
  await adminClient().from('uau_tables').update({
    last_sync_at_uat: new Date().toISOString(),
    last_status_uat: outcome.status,
    last_error_uat: outcome.error ?? null,
    last_rows_uat: outcome.rows ?? null,
    last_duration_ms_uat: outcome.durationMs,
  }).eq('id_uat', id);
}
