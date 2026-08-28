import type { CountMode } from '../types/data.js';

export const CACHEABLE_RESOURCES = new Set<string>([
  'v_fornecedores', 'v_compositions', 'compositions',
  'process_kinds', 'document_kinds', 'companies', 'cost_centers', 'persons',
  'departments', 'uau_tables',
]);

export const UAU_RESOURCES = new Set<string>([
  'v_fornecedores', 'v_compositions', 'compositions',
]);

export function cacheKey(resource: string, operations: unknown[], count: CountMode | false = false, head = false): string {
  return `data:${resource}:${count ? count : ''}${head ? 'h' : ''}:${JSON.stringify(operations || [])}`;
}

export function resourcePrefix(resource: string): string {
  return `data:${resource}:`;
}
