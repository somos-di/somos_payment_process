import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { NotFoundError } from '../errors.js';
import type { CommissionsService } from '../services/commissionsService.js';
import { UuidParamSchema } from '../validators/common.js';

// ações do fluxo e o payload esperado de cada uma
const NoteSchema = z.object({ note: z.string().trim().max(500).optional() });
// nullish: o front pode mandar a URL, ausente OU null (ex.: boleto não anexado).
// A trilha também pode editar e-mail/celular do vendedor ao validar (etapa 1).
const SetNfSchema = z.object({
  nf_url: z.string().max(2000).nullish(),
  boleto_url: z.string().max(2000).nullish(),
  seller_email: z.string().max(200).nullish(),
  seller_phone: z.string().max(50).nullish(),
});
const VALID_ACTIONS = new Set(['validate', 'set-nf', 'finalize', 'pendency', 'resolve', 'cancel']);
// cadastro de empreendimento (admin): nome, empresa (SPE), obra, trilha (somos), ativo.
const EmpreendimentoSchema = z.object({
  id: z.number().int().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1),
  building: z.string().trim().min(1),
  somos: z.boolean(),
  active: z.boolean().optional(),
});
const RemoveSchema = z.object({ id: z.number().int() });
// criação manual de comissão (trilha/admin): empreendimento (empresa+obra) + dados da venda.
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

  async create(req: FastifyRequest, reply: FastifyReply) {
    const c = CreateSchema.parse(req.body);
    const data = await this.service.create(req.accessToken!, c);
    return reply.send({ success: true, data });
  }

  async upsertEmpreendimento(req: FastifyRequest, reply: FastifyReply) {
    const e = EmpreendimentoSchema.parse(req.body);
    const data = await this.service.upsertEmpreendimento(req.accessToken!, e);
    return reply.send({ success: true, data });
  }

  async removeEmpreendimento(req: FastifyRequest, reply: FastifyReply) {
    const { id } = RemoveSchema.parse(req.body);
    await this.service.deleteEmpreendimento(req.accessToken!, id);
    return reply.send({ success: true });
  }

  async list(req: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.list(req.accessToken!) });
  }

  async get(req: FastifyRequest<{ Params: { uuid: string } }>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse(req.params);
    return reply.send({ success: true, data: await this.service.getByUuid(req.accessToken!, uuid) });
  }

  async action(req: FastifyRequest<{ Params: { uuid: string; action: string } }>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse({ uuid: req.params.uuid });
    const action = req.params.action;
    if (!VALID_ACTIONS.has(action)) throw new NotFoundError('Ação inválida');

    const body = (req.body ?? {}) as Record<string, unknown>;
    const opts: { note?: string; nfUrl?: string; boletoUrl?: string; sellerEmail?: string; sellerPhone?: string } = {};
    // etapa 1 (trilha): validar carrega a NF (obrigatória) + boleto e edição de e-mail/celular
    if (action === 'validate' || action === 'set-nf') {
      const b = SetNfSchema.parse(body);
      opts.nfUrl = b.nf_url ?? undefined; opts.boletoUrl = b.boleto_url ?? undefined;
      opts.sellerEmail = b.seller_email ?? undefined; opts.sellerPhone = b.seller_phone ?? undefined;
    } else if (action === 'pendency' || action === 'cancel') { opts.note = NoteSchema.parse(body).note; }

    const data = await this.service.transition(req.accessToken!, uuid, action, opts);
    return reply.send({ success: true, data });
  }
}
