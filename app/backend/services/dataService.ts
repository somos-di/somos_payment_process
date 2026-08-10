import { CACHEABLE_RESOURCES, cacheKey } from '../cache/cacheableResources.js';
import type { CacheManager } from '../cache/cacheManager.js';
import { AppError, NotFoundError } from '../errors.js';
import { adminClient, unwrap, userClient } from '../gateways/supabase.js';
import { getSettings } from '../settings.js';
import type { QueryOp, RpcArgs, UploadedFile } from '../types/data.js';
import { MAX_FILE_BYTES } from '../validators/common.js';

const READ_RESOURCES = new Set<string>([
  'v_processes', 'v_processes_no_approver', 'v_empresas', 'v_obras', 'v_fornecedores',
  'v_compositions', 'compositions', 'process_kinds', 'document_kinds', 'status_kind', 'companies',
  'cost_centers', 'persons', 'departments', 'uau_tables', 'installments', 'process_history',
  'v_process_history', 'v_process_approvers', 'v_no_approver', 'v_single_approver', 'v_with_approver', 'v_my_approvals', 'v_financeiro', 'v_financeiro_integrados', 'v_processes_admin', 'processes', 'groups', 'users_group',
  'company_rules', 'building_permission', 'process_kind_rules',
  'v_commissions', 'v_comm_empreendimentos', 'comm_empreendimentos', 'comm_status_kind', 'v_comm_history',
]);

const ADMIN_RESOURCES = new Set<string>(['v_no_approver', 'v_with_approver', 'groups', 'users_group',
  'company_rules', 'building_permission', 'process_kind_rules']);

const READ_RPCS = new Set<string>([
  'my_pending_approvals', 'my_pending_approval_groups', 'my_launchable_kinds',
  'completed_approvals', 'eligible_approvers', 'next_levels', 'quote_of_the_day',
]);

export class DataService {
  constructor(private readonly cache?: CacheManager) { }

  private async assertAdmin(token: string): Promise<void> {
    let userId = '';
    try { userId = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sub || ''; } catch { }
    const { data } = await adminClient().from('users').select('is_admin').eq('id_usr', userId).maybeSingle();
    if (!data?.is_admin) throw new AppError('Acesso restrito a administradores', 403, 'forbidden');
  }

  async query(token: string, resource: string, operations: QueryOp[], withCount = false, head = false): Promise<any> {
    if (!READ_RESOURCES.has(resource)) throw new NotFoundError(`Recurso não permitido: ${resource}`);
    if (ADMIN_RESOURCES.has(resource)) await this.assertAdmin(token);
    if (this.cache && CACHEABLE_RESOURCES.has(resource)) {
      const key = cacheKey(resource, operations, withCount, head);
      return this.cache.wrap(key, () => this.runQuery(token, resource, operations, withCount, head));
    }
    return this.runQuery(token, resource, operations, withCount, head);
  }

  private async runQuery(token: string, resource: string, operations: QueryOp[], withCount: boolean, head: boolean): Promise<any> {
    const selectOptions = (withCount || head) ? { count: 'exact' as const, head } : undefined;
    let query: any = userClient(token).from(resource).select('*', selectOptions);
    for (const operation of operations || []) {
      const [operationName, ...operationArgs] = operation;
      switch (operationName) {
        case 'eq': case 'neq': case 'gt': case 'gte': case 'lt': case 'lte':
        case 'like': case 'ilike': case 'is':
          query = query[operationName](operationArgs[0], operationArgs[1]); break;
        case 'in':
          query = query.in(operationArgs[0], operationArgs[1] as unknown[]); break;
        case 'or':
          query = query.or(operationArgs[0] as string); break;
        case 'order':
          query = query.order(operationArgs[0] as string, (operationArgs[1] as object) || {}); break;
        case 'limit':
          query = query.limit(operationArgs[0] as number); break;
        case 'range':
          query = query.range(operationArgs[0] as number, operationArgs[1] as number); break;
        default:
          throw new AppError(`Operação não suportada: ${operationName}`, 400, 'data');
      }
    }
    if (withCount || head) {
      const { data, error, count } = await query;
      if (error) throw new AppError((error as { message?: string }).message || 'Erro Supabase', 400, 'supabase');
      return { data: data ?? [], count };
    }
    return unwrap(query);
  }

  async rpc(token: string, rpcName: string, rpcArguments: RpcArgs) {
    if (!READ_RPCS.has(rpcName)) throw new NotFoundError(`RPC não permitida: ${rpcName}`);
    return unwrap(userClient(token).rpc(rpcName, rpcArguments || {}));
  }

  private async putObject(objectName: string, base64: string, contentType: string): Promise<UploadedFile> {
    const settings = getSettings();
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > MAX_FILE_BYTES) {
      throw new AppError(`Arquivo excede o limite de ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB`, 400, 'file_too_large');
    }
    const uploadResult = await adminClient().storage.from(settings.attachmentsBucket)
      .upload(objectName, buffer, { contentType: contentType || 'application/octet-stream', upsert: true });
    if (uploadResult.error) throw new AppError(uploadResult.error.message, 400, 'storage');
    const publicUrlResult = adminClient().storage.from(settings.attachmentsBucket).getPublicUrl(objectName);
    return { url: publicUrlResult.data.publicUrl };
  }

  private safeName(filename: string): string {
    return `${Date.now()}_${filename.replace(/[^\w.\-]/g, '_')}`;
  }

  uploadAttachment(filename: string, base64: string, contentType: string): Promise<UploadedFile> {
    return this.putObject(this.safeName(filename), base64, contentType);
  }

  uploadBulkImport(filename: string, base64: string, contentType: string): Promise<UploadedFile> {
    return this.putObject(`bulk-imports/${this.safeName(filename)}`, base64, contentType);
  }
}
