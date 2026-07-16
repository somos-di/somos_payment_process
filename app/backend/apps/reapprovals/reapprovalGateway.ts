import { AsyncHttpClient } from '../../base/abstract.js';
import type { AppSettings } from '../../settings.js';

export interface ReapprovalPayload {
  approverId: string;
  companyId: number;
  costCenterId: string;
  processId: number;
  installmentId: number;
}

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
