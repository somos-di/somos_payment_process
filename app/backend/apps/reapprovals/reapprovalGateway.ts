import { AsyncHttpClient } from '../../base/abstract.js';
import type { AppSettings } from '../../settings.js';

export interface ReapprovalPayload {
  approverId: string;
  companyId: number;
  costCenterId: string;
  processId: number;
  installmentId: number;
}

// Envia a reaprovação para o webhook do n8n (mini app /reaprovals). Base única do n8n
// (settings.n8nBaseUrl) + endpoint do fluxo (settings.reapproval.workflowEndPoint).
export class ReapprovalGateway extends AsyncHttpClient {
  private readonly endpoint: string;

  constructor(settings: AppSettings) {
    super(settings.n8nBaseUrl);
    this.endpoint = settings.reapproval.workflowEndPoint;
  }

  async send(payload: ReapprovalPayload): Promise<{ message: string }> {
    const data = (await this.post(this.endpoint, payload)) as { message?: string } | null;
    return { message: (data && data.message) || 'Reaprovação enviada.' };
  }
}
