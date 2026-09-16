import type { UauSyncService } from './sync.js';
import { getMaster, getSyncTables, recordTableRun } from './syncConfig.js';

const TICK_MS = 60_000;

export type SyncLogger = (message: string, error?: unknown) => void;

export class SyncScheduler {
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly service: UauSyncService, private readonly log: SyncLogger = () => { }) { }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.tick(); }, TICK_MS);
    if (typeof this.timer.unref === 'function') this.timer.unref();
    void this.tick();
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    let enabled = false, tables;
    try { enabled = (await getMaster()).enabled_syc; if (enabled) tables = await getSyncTables(); }
    catch { return; }
    if (!enabled || !tables) return;

    const due = tables.filter((table) => {
      if (!table.auto_enabled_uat) return false;
      const last = table.last_sync_at_uat ? new Date(table.last_sync_at_uat).getTime() : 0;
      return Date.now() >= last + Math.max(1, table.interval_minutes_uat) * 60_000;
    });
    if (!due.length) return;

    this.running = true;
    try {
      for (const table of due) {
        const startedAt = Date.now();
        try {
          const result = await this.service.syncById(table.id_uat);
          await recordTableRun(table.id_uat, { status: 'ok', rows: result.rows, durationMs: Date.now() - startedAt });
          this.log(`sync automático: ${table.supabase_uau_table_uat} (${result.rows} linha(s))`);
        } catch (error) {
          await recordTableRun(table.id_uat, { status: 'error', durationMs: Date.now() - startedAt, error: (error as { message?: string }).message || String(error) });
          this.log(`sync automático falhou: ${table.supabase_uau_table_uat}`, error);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
