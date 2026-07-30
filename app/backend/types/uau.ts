import type { z } from 'zod';
import type { uauTableSchema } from '../models/uauTable.js';

export type UauTable = z.infer<typeof uauTableSchema>;

export type UauQueryRow = Record<string, unknown>;

export type UauPayload = Record<string, unknown>;

export interface UauSyncResult {
  message: string;
  rows: number;
}

export interface UauSyncedTable {
  table: string;
  rows: number;
}

export interface UauIntegrationResult {
  uuid_prc: string;
  sent: true;
}
