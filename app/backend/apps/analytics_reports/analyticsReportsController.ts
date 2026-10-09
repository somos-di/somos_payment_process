import type { FastifyReply, FastifyRequest } from 'fastify';
import { IdParamSchema } from '../../validators/common.js';
import type { AnalyticsReportsService } from './analyticsReportsService.js';

export class AnalyticsReportsController {
  constructor(private readonly service: AnalyticsReportsService) {
    this.list = this.list.bind(this);
    this.file = this.file.bind(this);
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.list(request.accessToken!) });
  }

  async file(request: FastifyRequest, reply: FastifyReply) {
    const { id } = IdParamSchema.parse(request.params);
    return reply.send({ success: true, data: await this.service.file(request.accessToken!, id) });
  }
}
