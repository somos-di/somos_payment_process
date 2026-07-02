// Fonte única dos recursos que entram no cache do servidor (Redis) e do formato
// da chave — compartilhada entre DataService (leitura), CacheWarmer (warm no boot)
// e UauSyncService (refresh no sync). Evita duplicar essas listas/chaves.

// Recursos GLOBAIS (mesmo resultado para qualquer usuário: espelhos UAU + lookups).
// Só estes entram no cache — dados por-usuário (RLS) nunca são cacheados globalmente.
// status_kind não entra aqui: seu catálogo é desserializado/normalizado e cacheado
// à parte (chave 'catalog:status', via CatalogService), consumido por GET /catalog/status.
export const CACHEABLE_RESOURCES = new Set<string>([
  'v_empresas', 'v_obras', 'v_fornecedores', 'v_compositions', 'compositions',
  'process_kinds', 'document_kinds', 'companies', 'cost_centers', 'persons',
  'departments', 'uau_tables',
]);

// Subconjunto cujos dados vêm do UAU (reescritos pelo sync). Invalidados/refrescados
// no sync; os demais cacheáveis (catálogos próprios) só na ação destrutiva.
export const UAU_RESOURCES = new Set<string>([
  'v_empresas', 'v_obras', 'v_fornecedores', 'v_compositions', 'compositions',
]);

// Chave do cache: recurso + flags (count/head) + ops (filtros). A consulta "base"
// (sem filtros) é a que o warm popula no boot.
export function cacheKey(resource: string, ops: unknown[], withCount = false, head = false): string {
  return `data:${resource}:${withCount ? 'c' : ''}${head ? 'h' : ''}:${JSON.stringify(ops || [])}`;
}

// Prefixo que casa TODAS as variantes (todos os filtros) de um recurso — usado
// para invalidar o recurso inteiro.
export function resourcePrefix(resource: string): string {
  return `data:${resource}:`;
}
