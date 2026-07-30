import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DataService } from '../services/dataService.js';
import type { QueryOp } from '../types/data.js';
import type { DataQueryRoute, DataRpcRoute } from '../types/http.js';
import { MAX_UPLOAD_BASE64 } from '../validators/common.js';

const QuerySchema = z.object({
  operations: z.array(z.array(z.any())).optional().default([]),
  count: z.boolean().optional().default(false),
  head: z.boolean().optional().default(false),
});
const RpcSchema = z.object({ rpcArguments: z.record(z.any()).optional().default({}) });
const UploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentBase64: z.string().min(1).max(MAX_UPLOAD_BASE64),
  contentType: z.string().max(150).optional().default(''),
});

export class DataController {
  constructor(private readonly service: DataService) {
    this.query = this.query.bind(this);
    this.rpc = this.rpc.bind(this);
    this.upload = this.upload.bind(this);
    this.uploadBulk = this.uploadBulk.bind(this);
  }

  async query(request: FastifyRequest<DataQueryRoute>, reply: FastifyReply) {
    const { operations, count, head } = QuerySchema.parse(request.body ?? {});
    if (count || head) {
      const countedResult = await this.service.query(request.accessToken!, request.params.resource, operations as QueryOp[], true, head);
      return reply.send({ success: true, data: countedResult.data, count: countedResult.count });
    }
    const data = await this.service.query(request.accessToken!, request.params.resource, operations as QueryOp[]);
    return reply.send({ success: true, data });
  }

  async rpc(request: FastifyRequest<DataRpcRoute>, reply: FastifyReply) {
    const { rpcArguments } = RpcSchema.parse(request.body ?? {});
    const data = await this.service.rpc(request.accessToken!, request.params.fn, rpcArguments);
    return reply.send({ success: true, data });
  }

  async upload(request: FastifyRequest, reply: FastifyReply) {
    const { filename, contentBase64, contentType } = UploadSchema.parse(request.body);
    const data = await this.service.uploadAttachment(filename, contentBase64, contentType);
    return reply.send({ success: true, data });
  }

  async uploadBulk(request: FastifyRequest, reply: FastifyReply) {
    const { filename, contentBase64, contentType } = UploadSchema.parse(request.body);
    const data = await this.service.uploadBulkImport(filename, contentBase64, contentType);
    return reply.send({ success: true, data });
  }
}
