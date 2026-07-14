import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { NotFoundError } from '../errors.js';
import type { ProcessesService } from '../services/processesService.js';
import type { UauIntegrationService } from '../services/uauIntegrationService.js';
import { UuidParamSchema } from '../validators/common.js';

const InstallmentSchema = z.object({ due_date_ins: z.string(), value_ins: z.number() });
const SolicitationSchema = z.object({
  process: z.record(z.any()),
  installments: z.array(InstallmentSchema).default([]),
});
const BulkSchema = z.object({ items: z.array(SolicitationSchema).min(1).max(1000) });
const LogSchema = z.object({ action: z.string().min(1).max(200) });
const CorrectSchema = z.object({
  process: z.record(z.any()),
  installments: z.array(InstallmentSchema).optional(), // ausente = não mexe nas parcelas
  resend: z.boolean().default(false),
});
// GESTÃO (admin): motivo OBRIGATÓRIO; a autorização (is_admin) vive na RPC.
const AdminEditSchema = z.object({
  process: z.record(z.any()),
  installments: z.array(InstallmentSchema).optional(),
  reason: z.string().trim().min(1).max(500),
});

const ACTIONS: Record<string, string> = {
  approve: 'approve_process', close: 'close_process',
  // 'send-uau' e 'cancel' são tratados à parte (controller.action): send-uau monta o
  // payload + POSTa no webhook; cancel tem guard de autoria/status.
};
// Devoluções para correção: exigem MOTIVO (vai para o histórico via RPC).
const REASON_ACTIONS: Record<string, string> = {
  reject: 'reject_process', 'financeiro-reject': 'financeiro_reject',
};
const ReasonSchema = z.object({ reason: z.string().trim().min(1).max(500) });

export class ProcessesController {
  constructor(
    private readonly service: ProcessesService,
    private readonly uau: UauIntegrationService,
  ) {
    this.list = this.list.bind(this);
    this.get = this.get.bind(this);
    this.createFull = this.createFull.bind(this);
    this.createBulk = this.createBulk.bind(this);
    this.pending = this.pending.bind(this);
    this.action = this.action.bind(this);
    this.logEvent = this.logEvent.bind(this);
    this.correct = this.correct.bind(this);
    this.setInstallments = this.setInstallments.bind(this);
    this.adminEdit = this.adminEdit.bind(this);
  }

  async adminEdit(req: FastifyRequest<{ Params: { uuid: string } }>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: req.params.uuid });
    const { process, installments, reason } = AdminEditSchema.parse(req.body);
    const data = await this.service.adminEdit(req.accessToken!, uuid, process, installments, reason);
    return reply.send({ success: true, data });
  }

  async setInstallments(req: FastifyRequest<{ Params: { uuid: string } }>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: req.params.uuid });
    const { installments } = z.object({ installments: z.array(InstallmentSchema).default([]) }).parse(req.body);
    const data = await this.service.setInstallments(req.accessToken!, uuid, installments);
    return reply.send({ success: true, data });
  }

  async correct(req: FastifyRequest<{ Params: { uuid: string } }>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: req.params.uuid });
    const { process, installments, resend } = CorrectSchema.parse(req.body);
    const data = await this.service.correct(req.accessToken!, uuid, process, installments, resend);
    return reply.send({ success: true, data });
  }

  async logEvent(req: FastifyRequest<{ Params: { uuid: string } }>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: req.params.uuid });
    const { action } = LogSchema.parse(req.body);
    await this.service.log(req.accessToken!, uuid, action);
    return reply.send({ success: true });
  }

  async list(req: FastifyRequest<{ Querystring: { kind?: string } }>, reply: FastifyReply) {
    const kind = req.query.kind ? Number(req.query.kind) : undefined;
    return reply.send({ success: true, data: await this.service.list(req.accessToken!, kind) });
  }
  async pending(req: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.pending(req.accessToken!) });
  }
  async get(req: FastifyRequest<{ Params: { uuid: string } }>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse(req.params);
    return reply.send({ success: true, data: await this.service.getByUuid(req.accessToken!, uuid) });
  }
  async createFull(req: FastifyRequest, reply: FastifyReply) {
    const { process, installments } = SolicitationSchema.parse(req.body);
    const data = await this.service.createWithInstallments(req.accessToken!, process, installments);
    return reply.status(201).send({ success: true, data });
  }
  async createBulk(req: FastifyRequest, reply: FastifyReply) {
    const { items } = BulkSchema.parse(req.body);
    const data = await this.service.createBulk(req.accessToken!, items);
    return reply.send({ success: true, data });
  }
  async action(req: FastifyRequest<{ Params: { uuid: string; action: string } }>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: req.params.uuid });
    // cancelar: guard de autoria + status no backend (não confia no front)
    if (req.params.action === 'cancel') {
      const { reason } = ReasonSchema.parse(req.body ?? {}); // motivo obrigatório -> histórico
      await this.service.cancel(req.accessToken!, uuid, reason);
      return reply.send({ success: true });
    }
    // integrar (Enviar UAU): monta o payload do payment e POSTa no webhook de integração
    if (req.params.action === 'send-uau') {
      const data = await this.uau.sendToUau(req.accessToken!, uuid);
      return reply.send({ success: true, data });
    }
    // devolver para correção (aprovador/financeiro): motivo OBRIGATÓRIO -> histórico
    const reasonFn = REASON_ACTIONS[req.params.action];
    if (reasonFn) {
      const { reason } = ReasonSchema.parse(req.body ?? {});
      await this.service.actionWithReason(req.accessToken!, reasonFn, uuid, reason);
      return reply.send({ success: true });
    }
    const fn = ACTIONS[req.params.action];
    if (!fn) throw new NotFoundError('Ação inválida');
    await this.service.action(req.accessToken!, fn, uuid);
    return reply.send({ success: true });
  }
}
