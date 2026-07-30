import { z } from 'zod';
import type { MessageKindMap } from '../types/catalog.js';

export const messageKindSchema = z.object({
  id_msk: z.number().int(),
  name_msk: z.string(),
});

export function toMessageKindMap(rows: unknown[]): MessageKindMap {
  const byName: MessageKindMap = {};
  for (const row of rows) {
    const kind = messageKindSchema.parse(row);
    byName[kind.name_msk] = kind.id_msk;
  }
  return byName;
}
