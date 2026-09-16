import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { UauSyncService } from '../services/syncUauData/sync.js';
import { getMaster, getSyncTables, setMaster, setSyncTables } from '../services/syncUauData/syncConfig.js';
import { IdParamSchema } from '../validators/common.js';

const MasterSchema = z.object({ enabled: z.boolean() });
const TablesSchema = z.object({
  tables: z.array(z.object({
    id: z.coerce.number().int().positive(),
    auto_enabled: z.boolean().optional(),
    interval_minutes: z.coerce.number().int().min(1).max(10080).optional(),
  })).max(200),
});

export class SyncController {
  constructor(private readonly service: UauSyncService) {
    this.syncOne = this.syncOne.bind(this);
    this.syncAll = this.syncAll.bind(this);
    this.getConfig = this.getConfig.bind(this);
    this.setConfig = this.setConfig.bind(this);
    this.setTables = this.setTables.bind(this);
  }
  async syncOne(request: FastifyRequest, reply: FastifyReply) {
    const { id } = IdParamSchema.parse(request.params);
    return reply.send({ success: true, data: await this.service.syncById(id) });
  }
  async syncAll(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.syncAll() });
  }
  async getConfig(_request: FastifyRequest, reply: FastifyReply) {
    const [master, tables] = await Promise.all([getMaster(), getSyncTables()]);
    return reply.send({ success: true, data: { enabled: master.enabled_syc, tables } });
  }
  async setConfig(request: FastifyRequest, reply: FastifyReply) {
    const { enabled } = MasterSchema.parse(request.body);
    const master = await setMaster(enabled);
    return reply.send({ success: true, data: { enabled: master.enabled_syc } });
  }
  async setTables(request: FastifyRequest, reply: FastifyReply) {
    const { tables } = TablesSchema.parse(request.body);
    return reply.send({ success: true, data: await setSyncTables(tables) });
  }
}
