import type { CacheManager } from '../cache/cacheManager.js';
import { AppError, NotFoundError } from '../errors.js';
import { adminClient, userClient } from '../gateways/supabase.js';
import { getSettings } from '../settings.js';

// Recursos (tabelas/views) que o front pode LER. RLS ainda restringe as linhas.
const READ_RESOURCES = new Set<string>([
  'v_processes', 'v_processes_no_approver', 'v_empresas', 'v_obras', 'v_fornecedores',
  'v_compositions', 'compositions', 'process_kinds', 'document_kinds', 'status_kind', 'companies',
  'cost_centers', 'persons', 'departments', 'uau_tables', 'installments', 'process_history',
  'v_process_history', 'v_no_approver', 'v_my_approvals', 'v_financeiro', 'processes', 'groups', 'users_group',
]);

// Recursos GLOBAIS (mesmo resultado pra qualquer usuário: mirrors UAU + lookups).
// Só estes entram no cache de servidor — dados RLS por-usuário (v_processes,
// v_financeiro, etc.) NUNCA são cacheados globalmente (vazaria entre usuários).
// Invalidados em bloco no sync UAU (que reescreve as tabelas-espelho).
const CACHEABLE_RESOURCES = new Set<string>([
  'v_empresas', 'v_obras', 'v_fornecedores', 'v_compositions', 'compositions',
  'process_kinds', 'document_kinds', 'status_kind', 'companies', 'cost_centers', 'persons',
  'departments', 'uau_tables',
]);

// Recursos SÓ de admin: o diagnóstico v_no_approver (view sem security_invoker,
// ignora RLS) e o mapeamento usuário↔grupo. Leitura barrada a não-admin no backend
// (o menu/rota no front é só cosmético).
const ADMIN_RESOURCES = new Set<string>(['v_no_approver', 'groups', 'users_group']);

// RPCs de LEITURA liberadas pro front (ações ficam em /processes/:uuid/:action).
// completed_approvals/eligible_approvers gateiam can_see_process por dentro.
// process_levels/current_level saíram: não são usados pelo front e reduzem superfície.
const READ_RPCS = new Set<string>([
  'my_pending_approvals', 'completed_approvals', 'eligible_approvers', 'next_levels',
]);

type Op = [string, ...unknown[]];

export class DataService {
  constructor(private readonly cache?: CacheManager) { }

  private run<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
    return Promise.resolve(p).then(({ data, error }) => {
      if (error) throw new AppError((error as { message?: string }).message || 'Erro Supabase', 400, 'supabase');
      return data;
    });
  }

  // SELECT genérico. Recursos globais (CACHEABLE_RESOURCES) passam pelo cache
  // de servidor (L1+L2), com chave = resource + flags + ops. Os demais (RLS)
  // vão direto no Supabase.
  // gate de admin: lê is_admin do banco pelo sub do JWT (já validado no requireAuth).
  private async assertAdmin(token: string): Promise<void> {
    let sub = '';
    try { sub = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sub || ''; } catch { /* token malformado */ }
    const { data } = await adminClient().from('users').select('is_admin').eq('id_usr', sub).maybeSingle();
    if (!data?.is_admin) throw new AppError('Acesso restrito a administradores', 403, 'forbidden');
  }

  async query(token: string, resource: string, ops: Op[], withCount = false, head = false): Promise<any> {
    if (!READ_RESOURCES.has(resource)) throw new NotFoundError(`Recurso não permitido: ${resource}`);
    if (ADMIN_RESOURCES.has(resource)) await this.assertAdmin(token); // 403 se não-admin
    if (this.cache && CACHEABLE_RESOURCES.has(resource)) {
      const key = `data:${resource}:${withCount ? 'c' : ''}${head ? 'h' : ''}:${JSON.stringify(ops || [])}`;
      return this.cache.wrap(key, () => this.runQuery(token, resource, ops, withCount, head));
    }
    return this.runQuery(token, resource, ops, withCount, head);
  }

  private async runQuery(token: string, resource: string, ops: Op[], withCount: boolean, head: boolean): Promise<any> {
    const selectOpts = (withCount || head) ? { count: 'exact' as const, head } : undefined;
    let q: any = userClient(token).from(resource).select('*', selectOpts);
    for (const op of ops || []) {
      const [fn, ...args] = op;
      switch (fn) {
        case 'eq': case 'neq': case 'gt': case 'gte': case 'lt': case 'lte':
        case 'like': case 'ilike': case 'is':
          q = q[fn](args[0], args[1]); break;
        case 'in':
          q = q.in(args[0], args[1] as unknown[]); break;
        case 'or':
          q = q.or(args[0] as string); break;
        case 'order':
          q = q.order(args[0] as string, (args[1] as object) || {}); break;
        case 'limit':
          q = q.limit(args[0] as number); break;
        case 'range':
          q = q.range(args[0] as number, args[1] as number); break;
        default:
          throw new AppError(`Operação não suportada: ${fn}`, 400, 'data');
      }
    }
    if (withCount || head) {
      const { data, error, count } = await q;
      if (error) throw new AppError((error as { message?: string }).message || 'Erro Supabase', 400, 'supabase');
      return { data: data ?? [], count };
    }
    return this.run(q);
  }

  async rpc(token: string, fn: string, args: Record<string, unknown>) {
    if (!READ_RPCS.has(fn)) throw new NotFoundError(`RPC não permitida: ${fn}`);
    return this.run(userClient(token).rpc(fn, args || {}));
  }

  // upload de anexo (boleto/NF) -> bucket no Storage; devolve URL pública.
  async uploadAttachment(filename: string, base64: string, contentType: string): Promise<{ url: string }> {
    const s = getSettings();
    const buf = Buffer.from(base64, 'base64');
    const name = `${Date.now()}_${filename.replace(/[^\w.\-]/g, '_')}`;
    const up = await adminClient().storage.from(s.attachmentsBucket)
      .upload(name, buf, { contentType: contentType || 'application/octet-stream', upsert: true });
    if (up.error) throw new AppError(up.error.message, 400, 'storage');
    const pub = adminClient().storage.from(s.attachmentsBucket).getPublicUrl(name);
    return { url: pub.data.publicUrl };
  }
}
