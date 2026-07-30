import type { z } from 'zod';
import type { statusKindSchema } from '../models/statusKind.js';

export type StatusKind = z.infer<typeof statusKindSchema>;

export interface StatusCatalog {
  byId: Record<number, string>;
  byKey: Record<string, number>;
}

export interface ProcessKindRow {
  id_pkn: number;
  name_pkn: string;
}

export type ProcessKindMap = Record<number, string>;

export type MessageKindMap = Record<string, number>;

export interface CatalogBootstrap {
  steps: Record<number, string>;
  status: Record<string, number>;
  processKinds: ProcessKindMap;
  messageKinds: MessageKindMap;
}
