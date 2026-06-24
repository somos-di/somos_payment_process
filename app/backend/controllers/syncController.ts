import type { FastifyReply, FastifyRequest } from 'fastify';
import type { UauSyncService } from '../services/syncUauData/sync.js';
import { IdParamSchema } from '../validators/common.js';

export class SyncController {
  constructor(private readonly service: UauSyncService) {
    this.syncOne = this.syncOne.bind(this);
    this.syncAll = this.syncAll.bind(this);
  }
  async syncOne(req: FastifyRequest, reply: FastifyReply) {
    const { id } = IdParamSchema.parse(req.params);
    return reply.send({ success: true, data: await this.service.syncById(id) });
  }
  async syncAll(_req: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.syncAll() });
  }
}
