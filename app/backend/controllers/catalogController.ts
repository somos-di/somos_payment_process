import type { FastifyReply, FastifyRequest } from 'fastify';
import type { CatalogService } from '../services/catalogService.js';

// Serve os catálogos de domínio já normalizados pelo backend (ver CatalogService).
export class CatalogController {
  constructor(private readonly service: CatalogService) {
    this.status = this.status.bind(this);
  }

  async status(_req: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.statusCatalog() });
  }
}
