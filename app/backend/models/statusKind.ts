import { z } from 'zod';
import type { StatusCatalog } from '../types/catalog.js';

export const statusKindSchema = z.object({
  id_skn: z.number().int(),
  descr_skn: z.string(),
  key_skn: z.string().nullable(),
});

export function toStatusCatalog(rows: unknown[]): StatusCatalog {
  const byId: Record<number, string> = {};
  const byKey: Record<string, number> = {};
  for (const row of rows) {
    const statusKind = statusKindSchema.parse(row);
    byId[statusKind.id_skn] = statusKind.descr_skn;
    if (statusKind.key_skn) byKey[statusKind.key_skn] = statusKind.id_skn;
  }
  return { byId, byKey };
}
