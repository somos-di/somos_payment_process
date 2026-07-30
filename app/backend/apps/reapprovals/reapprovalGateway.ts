import { AsyncHttpClient } from '../../base/abstract.js';
import type { ReapprovalPayload, ReapprovalResult } from '../../types/reapprovals.js';
import type { AppSettings } from '../../types/settings.js';

export class ReapprovalGateway extends AsyncHttpClient {
  private readonly endpoint: string;

  constructor(settings: AppSettings) {
    super(settings.n8nBaseUrl);
    this.endpoint = settings.reapproval.workflowEndPoint;
  }

  async send(payload: ReapprovalPayload): Promise<ReapprovalResult> {
    const data = (await this.post(this.endpoint, payload)) as { message?: string } | null;
    return { message: (data && data.message) || 'Reaprovação enviada.' };
  }
}
