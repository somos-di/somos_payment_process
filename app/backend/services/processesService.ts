import { unwrap, userClient } from '../gateways/supabase.js';
import type {
  BatchApprovalResult, BulkCreateResult, InstallmentInput, InstallmentsReplaced,
  ProcessCorrected, ProcessCreated, ProcessFields, SolicitationInput,
} from '../types/process.js';

export class ProcessesService {
  private readonly table = 'processes';

  list(token: string, kind?: number) {
    let query = userClient(token).from(this.table).select('*').eq('active_prc', true);
    if (kind) query = query.eq('kind_prc', kind);
    return unwrap(query.order('id_prc', { ascending: false }));
  }

  getByUuid(token: string, uuid: string) {
    return unwrap(userClient(token).from(this.table).select('*').eq('uuid_prc', uuid).single());
  }

  createWithInstallments(
    token: string,
    process: ProcessFields,
    installments: InstallmentInput[],
  ): Promise<ProcessCreated> {
    return unwrap(userClient(token).rpc('create_process_with_installments', {
      p_process: process, p_installments: installments ?? [],
    })) as Promise<ProcessCreated>;
  }

  setInstallments(
    token: string, uuid: string,
    installments: InstallmentInput[],
  ): Promise<InstallmentsReplaced> {
    return unwrap(userClient(token).rpc('set_installments', {
      p_uuid: uuid, p_installments: installments ?? [],
    })) as Promise<InstallmentsReplaced>;
  }

  correct(
    token: string, uuid: string,
    process: ProcessFields,
    installments: InstallmentInput[] | undefined,
    resend: boolean,
  ): Promise<ProcessCorrected> {
    return unwrap(userClient(token).rpc('correct_process', {
      p_uuid: uuid, p_process: process,
      p_installments: installments ?? null, p_resend: resend,
    })) as Promise<ProcessCorrected>;
  }

  adminEdit(
    token: string, uuid: string,
    process: ProcessFields,
    installments: InstallmentInput[] | undefined,
    reason: string,
  ): Promise<ProcessCreated> {
    return unwrap(userClient(token).rpc('admin_edit_process', {
      p_uuid: uuid, p_process: process,
      p_installments: installments ?? null, p_reason: reason,
    })) as Promise<ProcessCreated>;
  }

  async createBulk(
    token: string,
    items: SolicitationInput[],
  ): Promise<BulkCreateResult[]> {
    const results: BulkCreateResult[] = [];
    for (const item of items) {
      try {
        const created = await this.createWithInstallments(token, item.process, item.installments || []);
        results.push({ ok: true, uuid_prc: created.uuid_prc });
      } catch (error) {
        results.push({ ok: false, error: (error as { message?: string }).message || 'erro' });
      }
    }
    return results;
  }

  pending(token: string) {
    return unwrap(userClient(token).rpc('my_pending_approvals', {}));
  }

  async approveBatch(
    token: string, uuids: string[],
  ): Promise<BatchApprovalResult[]> {
    const CONCURRENCY = 8;
    const results: BatchApprovalResult[] = new Array(uuids.length);
    const runOne = async (uuid: string, index: number): Promise<void> => {
      try {
        await this.action(token, 'approve_process', uuid);
        results[index] = { uuid, ok: true };
      } catch (error) {
        results[index] = { uuid, ok: false, error: (error as { message?: string }).message || 'erro' };
      }
    };
    for (let start = 0; start < uuids.length; start += CONCURRENCY) {
      await Promise.all(uuids.slice(start, start + CONCURRENCY).map((uuid, offsetInChunk) => runOne(uuid, start + offsetInChunk)));
    }
    return results;
  }

  action(token: string, rpcName: string, uuid: string) {
    return unwrap(userClient(token).rpc(rpcName, { p_uuid: uuid }));
  }

  actionWithReason(token: string, rpcName: string, uuid: string, reason: string) {
    return unwrap(userClient(token).rpc(rpcName, { p_uuid: uuid, p_reason: reason }));
  }

  cancel(token: string, uuid: string, reason: string) {
    return unwrap(userClient(token).rpc('cancel_process', { p_uuid: uuid, p_reason: reason }));
  }

  log(token: string, uuid: string, action: string) {
    return unwrap(userClient(token).rpc('log_process_event', { p_uuid: uuid, p_action: action }));
  }
}
