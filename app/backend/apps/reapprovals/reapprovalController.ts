import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { ReapprovalService } from './reapprovalService.js';

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
    this.list = this.list.bind(this);
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const payload = CreateSchema.parse(request.body);
    const data = await this.service.send(request.accessToken!, payload);
    return reply.send({ success: true, data });
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.list(request.accessToken!) });
  }
}
