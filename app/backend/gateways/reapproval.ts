import { AsyncHttpClient } from '../base/abstract.js';
import { RUNTIME } from '../config/runtime.js';
import type { AppSettings } from '../settings.js';

export interface ReapprovalPayload {
  approverId: string;
  companyId: number;
  costCenterId: string;
  processId: number;
  installmentId: number;
}

// Envia a solicitação de reaprovação para o webhook do n8n (mini app /reaprovals).
// Sem auth (o n8n valida pelo path do webhook). Base vem das settings; path é fixo.
export class ReapprovalGateway extends AsyncHttpClient {
  constructor(settings: AppSettings) {
    super(settings.reapproval.baseUrl);
  }

  async send(payload: ReapprovalPayload): Promise<{ message: string }> {
    const data = (await this.post(RUNTIME.reapproval.webhookPath, payload)) as { message?: string } | null;
    return { message: (data && data.message) || 'Reaprovação enviada.' };
  }
}
