import { unwrap, userClient } from '../../gateways/supabase.js';
import type { ReapprovalPayload, ReapprovalResult } from '../../types/reapprovals.js';
import type { ReapprovalGateway } from './reapprovalGateway.js';

export class ReapprovalService {
  constructor(private readonly gateway: ReapprovalGateway) { }

  async send(token: string, payload: ReapprovalPayload): Promise<ReapprovalResult> {
    const { message } = await this.gateway.send(payload);
    try {
      await unwrap(userClient(token).rpc('reapproval_log', {
        p_company: payload.companyId, p_cost_center: payload.costCenterId,
        p_process: payload.processId, p_installment: payload.installmentId,
        p_approver: payload.approverId, p_message: message,
      }));
    } catch { }
    return { message };
  }

  list(token: string) {
    return unwrap(userClient(token).from('v_reapprovals').select('*').order('id_rap', { ascending: false }));
  }
}
