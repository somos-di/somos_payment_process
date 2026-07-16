import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DataService } from '../services/dataService.js';
import { MAX_UPLOAD_B64 } from '../validators/common.js';

const QuerySchema = z.object({
  ops: z.array(z.array(z.any())).optional().default([]),
  count: z.boolean().optional().default(false),
  head: z.boolean().optional().default(false), // só o total e sem trafegar linhas
});
const RpcSchema = z.object({ args: z.record(z.any()).optional().default({}) });
const UploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentBase64: z.string().min(1).max(MAX_UPLOAD_B64), // rejeita payload gigante cedo, tamanho real conferido no service
  contentType: z.string().max(150).optional().default(''),
});

export class DataController {
  constructor(private readonly service: DataService) {
    this.query = this.query.bind(this);
    this.rpc = this.rpc.bind(this);
    this.upload = this.upload.bind(this);
    this.uploadBulk = this.uploadBulk.bind(this);
  }

  async query(req: FastifyRequest<{ Params: { resource: string } }>, reply: FastifyReply) {
    const { ops, count, head } = QuerySchema.parse(req.body ?? {});
    if (count || head) {
      const res = await this.service.query(req.accessToken!, req.params.resource, ops as [string, ...unknown[]][], true, head);
      return reply.send({ success: true, data: res.data, count: res.count });
    }
    const data = await this.service.query(req.accessToken!, req.params.resource, ops as [string, ...unknown[]][]);
    return reply.send({ success: true, data });
  }

  async rpc(req: FastifyRequest<{ Params: { fn: string } }>, reply: FastifyReply) {
    const { args } = RpcSchema.parse(req.body ?? {});
    const data = await this.service.rpc(req.accessToken!, req.params.fn, args);
    return reply.send({ success: true, data });
  }

  async upload(req: FastifyRequest, reply: FastifyReply) {
    const { filename, contentBase64, contentType } = UploadSchema.parse(req.body);
    const data = await this.service.uploadAttachment(filename, contentBase64, contentType);
    return reply.send({ success: true, data });
  }

  // salva o XLSX de origem do lançamento em massa no Storage (pasta bulk-imports/)
  async uploadBulk(req: FastifyRequest, reply: FastifyReply) {
    const { filename, contentBase64, contentType } = UploadSchema.parse(req.body);
    const data = await this.service.uploadBulkImport(filename, contentBase64, contentType);
    return reply.send({ success: true, data });
  }
}
