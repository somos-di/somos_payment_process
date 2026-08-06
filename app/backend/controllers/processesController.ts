import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { NotFoundError } from '../errors.js';
import type { ProcessCreatorGateway } from '../gateways/processCreator.js';
import type { ProcessesService } from '../services/processesService.js';
import type { UauIntegrationService } from '../services/uauIntegrationService.js';
import type { ProcessListRoute, UuidActionRoute, UuidRoute } from '../types/http.js';
import { UuidParamSchema, boundedRecord } from '../validators/common.js';

const InstallmentSchema = z.object({ due_date_ins: z.string(), value_ins: z.number() });
const SolicitationSchema = z.object({
  process: boundedRecord,
  installments: z.array(InstallmentSchema).default([]),
});
const BulkSchema = z.object({ items: z.array(SolicitationSchema).min(1).max(1000) });
const LogSchema = z.object({ action: z.string().min(1).max(200), kind: z.number().int().positive().optional() });
const QuickExtractSchema = z.object({ content: z.string().min(1) });
const CorrectSchema = z.object({
  process: boundedRecord,
  installments: z.array(InstallmentSchema).optional(),
  resend: z.boolean().default(false),
});
const AdminEditSchema = z.object({
  process: boundedRecord,
  installments: z.array(InstallmentSchema).optional(),
  reason: z.string().trim().min(1).max(500),
});

const ACTIONS: Record<string, string> = {
  approve: 'approve_process', close: 'close_process',
};
const REASON_ACTIONS: Record<string, string> = {
  reject: 'reject_process', 'financeiro-reject': 'financeiro_reject',
};
const ReasonSchema = z.object({ reason: z.string().trim().min(1).max(500) });
const ApproveBatchSchema = z.object({ uuids: z.array(z.string().uuid()).min(1).max(200) });

export class ProcessesController {
  constructor(
    private readonly service: ProcessesService,
    private readonly uauIntegration: UauIntegrationService,
    private readonly processCreator: ProcessCreatorGateway,
  ) {
    this.list = this.list.bind(this);
    this.quickExtract = this.quickExtract.bind(this);
    this.get = this.get.bind(this);
    this.createFull = this.createFull.bind(this);
    this.createBulk = this.createBulk.bind(this);
    this.pending = this.pending.bind(this);
    this.action = this.action.bind(this);
    this.logEvent = this.logEvent.bind(this);
    this.correct = this.correct.bind(this);
    this.setInstallments = this.setInstallments.bind(this);
    this.adminEdit = this.adminEdit.bind(this);
    this.approveBatch = this.approveBatch.bind(this);
  }

  async approveBatch(request: FastifyRequest, reply: FastifyReply) {
    const { uuids } = ApproveBatchSchema.parse(request.body);
    const data = await this.service.approveBatch(request.accessToken!, uuids);
    return reply.send({ success: true, data });
  }

  async adminEdit(request: FastifyRequest<UuidRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: request.params.uuid });
    const { process, installments, reason } = AdminEditSchema.parse(request.body);
    const data = await this.service.adminEdit(request.accessToken!, uuid, process, installments, reason);
    return reply.send({ success: true, data });
  }

  async setInstallments(request: FastifyRequest<UuidRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: request.params.uuid });
    const { installments } = z.object({ installments: z.array(InstallmentSchema).default([]) }).parse(request.body);
    const data = await this.service.setInstallments(request.accessToken!, uuid, installments);
    return reply.send({ success: true, data });
  }

  async correct(request: FastifyRequest<UuidRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: request.params.uuid });
    const { process, installments, resend } = CorrectSchema.parse(request.body);
    const data = await this.service.correct(request.accessToken!, uuid, process, installments, resend);
    return reply.send({ success: true, data });
  }

  async logEvent(request: FastifyRequest<UuidRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: request.params.uuid });
    const { action, kind } = LogSchema.parse(request.body);
    await this.service.log(request.accessToken!, uuid, action, kind);
    return reply.send({ success: true });
  }

  async quickExtract(request: FastifyRequest, reply: FastifyReply) {
    const { content } = QuickExtractSchema.parse(request.body);
    const data = await this.processCreator.extractFromDocument(content);
    return reply.send({ success: true, data });
  }

  async list(request: FastifyRequest<ProcessListRoute>, reply: FastifyReply) {
    const kind = request.query.kind ? Number(request.query.kind) : undefined;
    return reply.send({ success: true, data: await this.service.list(request.accessToken!, kind) });
  }
  async pending(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.pending(request.accessToken!) });
  }
  async get(request: FastifyRequest<UuidRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse(request.params);
    return reply.send({ success: true, data: await this.service.getByUuid(request.accessToken!, uuid) });
  }
  async createFull(request: FastifyRequest, reply: FastifyReply) {
    const { process, installments } = SolicitationSchema.parse(request.body);
    const data = await this.service.createWithInstallments(request.accessToken!, process, installments);
    return reply.status(201).send({ success: true, data });
  }
  async createBulk(request: FastifyRequest, reply: FastifyReply) {
    const { items } = BulkSchema.parse(request.body);
    const data = await this.service.createBulk(request.accessToken!, items);
    return reply.send({ success: true, data });
  }
  async action(request: FastifyRequest<UuidActionRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: request.params.uuid });
    if (request.params.action === 'cancel') {
      const { reason } = ReasonSchema.parse(request.body ?? {});
      await this.service.cancel(request.accessToken!, uuid, reason);
      return reply.send({ success: true });
    }
    if (request.params.action === 'send-uau') {
      const data = await this.uauIntegration.sendToUau(request.accessToken!, uuid);
      return reply.send({ success: true, data });
    }
    const reasonFn = REASON_ACTIONS[request.params.action];
    if (reasonFn) {
      const { reason } = ReasonSchema.parse(request.body ?? {});
      await this.service.actionWithReason(request.accessToken!, reasonFn, uuid, reason);
      return reply.send({ success: true });
    }
    const rpcName = ACTIONS[request.params.action];
    if (!rpcName) throw new NotFoundError('Ação inválida');
    await this.service.action(request.accessToken!, rpcName, uuid);
    return reply.send({ success: true });
  }
}
