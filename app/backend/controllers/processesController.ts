import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { NotFoundError } from '../errors.js';
import { ProcessInsertSchema } from '../models/process.js';
import type { ProcessesService } from '../services/processesService.js';
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

const ACTIONS: Record<string, string> = {
  approve: 'approve_process', reject: 'reject_process', close: 'close_process',
  'financeiro-reject': 'financeiro_reject', 'send-uau': 'send_to_uau',
  cancel: 'cancel_process', // autor cancela (status->0) — só em status 1 ou 2
};

export class ProcessesController {
  constructor(private readonly service: ProcessesService) {
    this.list = this.list.bind(this);
    this.get = this.get.bind(this);
    this.create = this.create.bind(this);
    this.createFull = this.createFull.bind(this);
    this.createBulk = this.createBulk.bind(this);
    this.pending = this.pending.bind(this);
    this.action = this.action.bind(this);
    this.logEvent = this.logEvent.bind(this);
    this.correct = this.correct.bind(this);
    this.setInstallments = this.setInstallments.bind(this);
  }

  async setInstallments(req: FastifyRequest<{ Params: { uuid: string } }>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: req.params.uuid });
    const { installments } = z.object({ installments: z.array(InstallmentSchema).default([]) }).parse(req.body);
    const data = await this.service.setInstallments(req.accessToken!, req.user!.id, uuid, installments);
    return reply.send({ success: true, data });
  }

  async correct(req: FastifyRequest<{ Params: { uuid: string } }>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: req.params.uuid });
    const { process, installments, resend } = CorrectSchema.parse(req.body);
    const data = await this.service.correct(req.accessToken!, req.user!.id, uuid, process, installments, resend);
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
  async create(req: FastifyRequest, reply: FastifyReply) {
    const body = ProcessInsertSchema.parse(req.body);
    const data = await this.service.create(req.accessToken!, req.user!.id, body);
    return reply.status(201).send({ success: true, data });
  }
  async createFull(req: FastifyRequest, reply: FastifyReply) {
    const { process, installments } = SolicitationSchema.parse(req.body);
    const data = await this.service.createWithInstallments(req.accessToken!, req.user!.id, process, installments);
    return reply.status(201).send({ success: true, data });
  }
  async createBulk(req: FastifyRequest, reply: FastifyReply) {
    const { items } = BulkSchema.parse(req.body);
    const data = await this.service.createBulk(req.accessToken!, req.user!.id, items);
    return reply.send({ success: true, data });
  }
  async action(req: FastifyRequest<{ Params: { uuid: string; action: string } }>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: req.params.uuid });
    const fn = ACTIONS[req.params.action];
    if (!fn) throw new NotFoundError('Ação inválida');
    await this.service.action(req.accessToken!, fn, uuid);
    return reply.send({ success: true });
  }
}
