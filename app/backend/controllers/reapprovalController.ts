import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { ReapprovalService } from '../services/reapprovalService.js';

// mesmo contrato do app de origem: aprovador + empresa + obra(centro de custo) + processo + parcela
const CreateSchema = z.object({
  approverId: z.string().trim().min(1).max(200),
  companyId: z.number().int().positive(),
  costCenterId: z.string().trim().min(1).max(100),
  processId: z.number().int().positive(),
  installmentId: z.number().int().positive(),
});

export class ReapprovalController {
  constructor(private readonly service: ReapprovalService) {
    this.create = this.create.bind(this);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const payload = CreateSchema.parse(req.body);
    const data = await this.service.send(payload);
    return reply.send({ success: true, data });
  }
}
