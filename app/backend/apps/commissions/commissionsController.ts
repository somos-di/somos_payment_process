import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { NotFoundError } from '../../errors.js';
import type { CommissionTransitionOptions } from '../../types/commissions.js';
import type { UuidActionRoute, UuidRoute } from '../../types/http.js';
import { UuidParamSchema } from '../../validators/common.js';
import type { CommissionsService } from './commissionsService.js';


const NoteSchema = z.object({ note: z.string().trim().max(500).optional() });

const CancelSchema = z.object({ note: z.string().trim().min(1).max(500) });

const SetNfSchema = z.object({
  nf_url: z.string().max(2000).nullish(),
  boleto_url: z.string().max(2000).nullish(),
  seller_email: z.string().max(200).nullish(),
  seller_phone: z.string().max(50).nullish(),
});
const VALID_ACTIONS = new Set(['validate', 'set-nf', 'finalize', 'pendency', 'resolve', 'cancel']);

const EmpreendimentoSchema = z.object({
  id: z.number().int().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1),
  building: z.string().trim().min(1),
  somos: z.boolean(),
  active: z.boolean().optional(),
});
const RemoveSchema = z.object({ id: z.number().int() });

const optText = z.string().trim().max(200).optional();
const CreateSchema = z.object({
  company: z.string().trim().min(1),
  building: z.string().trim().min(1),
  value: z.number().positive(),
  sellerName: z.string().trim().min(1).max(200),
  clientName: z.string().trim().min(1).max(200),
  unit: z.string().trim().max(100).optional(),
  saleNum: z.string().trim().max(100).optional(),
  saleDate: z.string().trim().optional(),
  releaseDate: z.string().trim().optional(),
  sellerId: z.number().int().optional(),
  sellerEmail: optText,
  sellerPhone: z.string().trim().max(50).optional(),
  note: z.string().trim().max(500).optional(),
});

export class CommissionsController {
  constructor(private readonly service: CommissionsService) {
    this.list = this.list.bind(this);
    this.get = this.get.bind(this);
    this.action = this.action.bind(this);
    this.create = this.create.bind(this);
    this.upsertEmpreendimento = this.upsertEmpreendimento.bind(this);
    this.removeEmpreendimento = this.removeEmpreendimento.bind(this);
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const commission = CreateSchema.parse(request.body);
    const data = await this.service.create(request.accessToken!, commission);
    return reply.send({ success: true, data });
  }

  async upsertEmpreendimento(request: FastifyRequest, reply: FastifyReply) {
    const empreendimento = EmpreendimentoSchema.parse(request.body);
    const data = await this.service.upsertEmpreendimento(request.accessToken!, empreendimento);
    return reply.send({ success: true, data });
  }

  async removeEmpreendimento(request: FastifyRequest, reply: FastifyReply) {
    const { id } = RemoveSchema.parse(request.body);
    await this.service.deleteEmpreendimento(request.accessToken!, id);
    return reply.send({ success: true });
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.list(request.accessToken!) });
  }

  async get(request: FastifyRequest<UuidRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse(request.params);
    return reply.send({ success: true, data: await this.service.getByUuid(request.accessToken!, uuid) });
  }

  async action(request: FastifyRequest<UuidActionRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: request.params.uuid });
    const action = request.params.action;
    if (!VALID_ACTIONS.has(action)) throw new NotFoundError('Ação inválida');

    const body = (request.body ?? {}) as Record<string, unknown>;
    const transitionOptions: CommissionTransitionOptions = {};

    if (action === 'validate' || action === 'set-nf') {
      const parsedBody = SetNfSchema.parse(body);
      transitionOptions.nfUrl = parsedBody.nf_url ?? undefined; transitionOptions.boletoUrl = parsedBody.boleto_url ?? undefined;
      transitionOptions.sellerEmail = parsedBody.seller_email ?? undefined; transitionOptions.sellerPhone = parsedBody.seller_phone ?? undefined;
    } else if (action === 'cancel') { transitionOptions.note = CancelSchema.parse(body).note; }
    else if (action === 'pendency') { transitionOptions.note = NoteSchema.parse(body).note; }

    const data = await this.service.transition(request.accessToken!, uuid, action, transitionOptions);
    return reply.send({ success: true, data });
  }
}
