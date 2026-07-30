
export const CACHEABLE_RESOURCES = new Set<string>([
  'v_empresas', 'v_obras', 'v_fornecedores', 'v_compositions', 'compositions',
  'process_kinds', 'document_kinds', 'companies', 'cost_centers', 'persons',
  'departments', 'uau_tables',
]);

export const UAU_RESOURCES = new Set<string>([
  'v_empresas', 'v_obras', 'v_fornecedores', 'v_compositions', 'compositions',
]);

export function cacheKey(resource: string, operations: unknown[], withCount = false, head = false): string {
  return `data:${resource}:${withCount ? 'c' : ''}${head ? 'h' : ''}:${JSON.stringify(operations || [])}`;
}

export function resourcePrefix(resource: string): string {
  return `data:${resource}:`;
}
