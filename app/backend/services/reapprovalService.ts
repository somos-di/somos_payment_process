import type { ReapprovalGateway, ReapprovalPayload } from '../gateways/reapproval.js';

// Orquestra a reaprovação: delega o envio ao gateway (n8n). Sem estado.
export class ReapprovalService {
  constructor(private readonly gateway: ReapprovalGateway) {}

  send(payload: ReapprovalPayload): Promise<{ message: string }> {
    return this.gateway.send(payload);
  }
}
