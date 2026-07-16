import { unwrap, userClient } from '../gateways/supabase.js';
import type { ReapprovalGateway, ReapprovalPayload } from '../gateways/reapproval.js';

// Orquestra a reaprovação: envia ao n8n (gateway) e REGISTRA no histórico
// (payment.reapprovals via RPC definer, author = auth.uid(), gate is_admin).
export class ReapprovalService {
  constructor(private readonly gateway: ReapprovalGateway) {}

  async send(token: string, payload: ReapprovalPayload): Promise<{ message: string }> {
    const { message } = await this.gateway.send(payload);
    // log é best-effort: o envio ao n8n já ocorreu; não falha a ação se o registro falhar.
    try {
      await unwrap(userClient(token).rpc('reapproval_log', {
        p_company: payload.companyId, p_cost_center: payload.costCenterId,
        p_process: payload.processId, p_installment: payload.installmentId,
        p_approver: payload.approverId, p_message: message,
      }));
    } catch { /* ignore */ }
    return { message };
  }

  list(token: string) {
    return unwrap(userClient(token).from('v_reapprovals').select('*').order('id_rap', { ascending: false }));
  }
}
