import type { FastifyReply, FastifyRequest } from 'fastify';
import type { CatalogService } from '../services/catalogService.js';

export class CatalogController {
  constructor(private readonly service: CatalogService) {
    this.status = this.status.bind(this);
    this.bootstrap = this.bootstrap.bind(this);
  }

  async status(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.statusCatalog() });
  }

  async bootstrap(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.bootstrap() });
  }
}
