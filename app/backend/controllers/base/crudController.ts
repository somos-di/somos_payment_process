import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ZodType } from 'zod';
import { NotFoundError } from '../../errors.js';
import { userClient } from '../../gateways/supabase.js';
import type { CrudService } from '../../services/base/crudService.js';
import { IdParamSchema } from '../../validators/common.js';

export abstract class CrudController<TRow, TInsert, TUpdate> {
  constructor(
    protected readonly service: CrudService<TRow, TInsert, TUpdate>,
    protected readonly insertSchema: ZodType<TInsert>,
    protected readonly updateSchema: ZodType<TUpdate>,
  ) {
    this.insertOne = this.insertOne.bind(this);
    this.updateOne = this.updateOne.bind(this);
    this.readOne = this.readOne.bind(this);
    this.readMany = this.readMany.bind(this);
  }
  protected client(req: FastifyRequest) { return userClient(req.accessToken!); }

  async insertOne(req: FastifyRequest, reply: FastifyReply) {
    const body = this.insertSchema.parse(req.body);
    return reply.status(201).send({ success: true, data: await this.service.insertOne(this.client(req), body) });
  }
  async updateOne(req: FastifyRequest, reply: FastifyReply) {
    const { id } = IdParamSchema.parse(req.params);
    const body = this.updateSchema.parse(req.body);
    return reply.send({ success: true, data: await this.service.updateOne(this.client(req), id, body) });
  }
  async readOne(req: FastifyRequest, reply: FastifyReply) {
    const { id } = IdParamSchema.parse(req.params);
    const data = await this.service.readOne(this.client(req), id);
    if (!data) throw new NotFoundError();
    return reply.send({ success: true, data });
  }
  async readMany(req: FastifyRequest, reply: FastifyReply) {
    const data = await this.service.readMany(this.client(req), (req.query ?? {}) as Record<string, unknown>);
    return reply.send({ success: true, data });
  }
}
