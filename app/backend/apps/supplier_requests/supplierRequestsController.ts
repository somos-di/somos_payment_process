import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { NotFoundError } from '../../errors.js';
import type { UuidActionRoute, UuidRoute } from '../../types/http.js';
import type { SupplierTransitionOptions } from '../../types/supplierRequests.js';
import { UuidParamSchema } from '../../validators/common.js';
import type { SupplierRequestsService } from './supplierRequestsService.js';

const optText = z.string().trim().max(300).optional();
const FieldsSchema = z.object({
  cnpj: optText, cpf: optText, nome: optText, razao_social: optText, cep: optText, city_id: optText,
  municipio: optText, uf: optText, logradouro: optText, numero: optText, bairro: optText, complemento: optText,
  telefone: optText, email: optText, inscricao_estadual: optText, atividade_principal: optText, atividades_secundarias: optText,
});

const CreateSchema = z.object({
  kind: z.enum(['pj', 'pf']),
  document: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(300),
  fantasy: z.string().trim().max(300).optional(),
  fields: FieldsSchema.optional().default({}),
  company: z.string().trim().max(50).optional(),
  building: z.string().trim().max(50).optional(),
});

const CommentSchema = z.object({ text: z.string().trim().min(1).max(2000) });
const NoteSchema = z.object({ note: z.string().trim().max(500).optional() });
const ReasonSchema = z.object({ note: z.string().trim().min(1).max(500) });
const LookupSchema = z.object({ cnpj: z.string().trim().min(1) });
const CheckSchema = z.object({ document: z.string().trim().min(1), kind: z.enum(['pj', 'pf']) });

const VALID_ACTIONS = new Set(['cancel', 'reject', 'resubmit']);

export class SupplierRequestsController {
  constructor(private readonly service: SupplierRequestsService) {
    this.list = this.list.bind(this);
    this.get = this.get.bind(this);
    this.create = this.create.bind(this);
    this.comment = this.comment.bind(this);
    this.action = this.action.bind(this);
    this.send = this.send.bind(this);
    this.lookup = this.lookup.bind(this);
    this.checkUau = this.checkUau.bind(this);
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.list(request.accessToken!) });
  }

  async get(request: FastifyRequest<UuidRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse(request.params);
    return reply.send({ success: true, data: await this.service.getByUuid(request.accessToken!, uuid) });
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const input = CreateSchema.parse(request.body);
    const data = await this.service.create(request.accessToken!, input);
    return reply.send({ success: true, data });
  }

  async comment(request: FastifyRequest<UuidRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: request.params.uuid });
    const { text } = CommentSchema.parse(request.body);
    await this.service.comment(request.accessToken!, uuid, text);
    return reply.send({ success: true });
  }

  async action(request: FastifyRequest<UuidActionRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: request.params.uuid });
    const action = request.params.action;
    if (!VALID_ACTIONS.has(action)) throw new NotFoundError('Ação inválida');
    const body = (request.body ?? {}) as Record<string, unknown>;
    const options: SupplierTransitionOptions = {};
    if (action === 'cancel' || action === 'reject') options.note = ReasonSchema.parse(body).note;
    else options.note = NoteSchema.parse(body).note;
    const data = await this.service.transition(request.accessToken!, uuid, action, options);
    return reply.send({ success: true, data });
  }

  async send(request: FastifyRequest<UuidRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: request.params.uuid });
    const data = await this.service.send(request.accessToken!, uuid);
    return reply.send({ success: true, data });
  }

  async lookup(request: FastifyRequest<{ Querystring: { cnpj?: string } }>, reply: FastifyReply) {
    const { cnpj } = LookupSchema.parse(request.query);
    return reply.send({ success: true, data: await this.service.lookup(cnpj) });
  }

  async checkUau(request: FastifyRequest<{ Querystring: { document?: string; kind?: string } }>, reply: FastifyReply) {
    const { document, kind } = CheckSchema.parse(request.query);
    return reply.send({ success: true, data: await this.service.checkUau(document, kind) });
  }
}
