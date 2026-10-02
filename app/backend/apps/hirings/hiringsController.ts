import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { UuidRoute } from '../../types/http.js';
import { UuidParamSchema } from '../../validators/common.js';
import type { HiringCreateInput, HiringsService } from './hiringsService.js';

const optText = (max: number) => z.string().trim().max(max).nullish();

const CreateSchema = z.object({
  department: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(300),
  contract_type: z.string().trim().min(1).max(100),
  age: z.coerce.number().int().min(0).max(120).nullish(),
  salary: z.coerce.number().min(0).max(99999999).nullish(),
  period: optText(200),
  resume_url: optText(2000),
  cargo: optText(120),
  level: optText(80),
  reason: optText(300),
  social: optText(1000),
});
const UpdateSchema = CreateSchema.omit({ department: true });
const ReasonSchema = z.object({ reason: z.string().trim().min(1).max(500) });
const ManagersSchema = z.object({ users: z.array(z.string().uuid()).max(100).default([]) });
const DeptIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

function toInput(data: z.infer<typeof CreateSchema> | z.infer<typeof UpdateSchema>, department?: number): HiringCreateInput {
  return {
    department: department ?? (data as z.infer<typeof CreateSchema>).department,
    name: data.name, contractType: data.contract_type,
    age: data.age ?? null, salary: data.salary ?? null,
    period: data.period ?? null, resumeUrl: data.resume_url ?? null,
    cargo: data.cargo ?? null, level: data.level ?? null,
    reason: data.reason ?? null, social: data.social ?? null,
  };
}

export class HiringsController {
  constructor(private readonly service: HiringsService) {
    this.list = this.list.bind(this);
    this.get = this.get.bind(this);
    this.history = this.history.bind(this);
    this.departments = this.departments.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.approve = this.approve.bind(this);
    this.finalize = this.finalize.bind(this);
    this.reject = this.reject.bind(this);
    this.resubmit = this.resubmit.bind(this);
    this.cancel = this.cancel.bind(this);
    this.users = this.users.bind(this);
    this.deptSetManagers = this.deptSetManagers.bind(this);
  }

  async users(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.users(request.accessToken!) });
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.list(request.accessToken!) });
  }
  async get(request: FastifyRequest<UuidRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse(request.params);
    return reply.send({ success: true, data: await this.service.getByUuid(request.accessToken!, uuid) });
  }
  async history(request: FastifyRequest<UuidRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse(request.params);
    return reply.send({ success: true, data: await this.service.history(request.accessToken!, uuid) });
  }
  async departments(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.departments(request.accessToken!) });
  }
  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = CreateSchema.parse(request.body);
    return reply.send({ success: true, data: await this.service.create(request.accessToken!, toInput(data)) });
  }
  async update(request: FastifyRequest<UuidRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse(request.params);
    const data = UpdateSchema.parse(request.body);
    return reply.send({ success: true, data: await this.service.update(request.accessToken!, uuid, toInput(data, 0)) });
  }
  async approve(request: FastifyRequest<UuidRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse(request.params);
    return reply.send({ success: true, data: await this.service.approve(request.accessToken!, uuid) });
  }
  async finalize(request: FastifyRequest<UuidRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse(request.params);
    return reply.send({ success: true, data: await this.service.finalize(request.accessToken!, uuid) });
  }
  async reject(request: FastifyRequest<UuidRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse(request.params);
    const { reason } = ReasonSchema.parse(request.body);
    return reply.send({ success: true, data: await this.service.reject(request.accessToken!, uuid, reason) });
  }
  async resubmit(request: FastifyRequest<UuidRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse(request.params);
    return reply.send({ success: true, data: await this.service.resubmit(request.accessToken!, uuid) });
  }
  async cancel(request: FastifyRequest<UuidRoute>, reply: FastifyReply) {
    const { uuid } = UuidParamSchema.parse(request.params);
    const { reason } = ReasonSchema.parse(request.body);
    return reply.send({ success: true, data: await this.service.cancel(request.accessToken!, uuid, reason) });
  }
  async deptSetManagers(request: FastifyRequest, reply: FastifyReply) {
    const { id } = DeptIdParamSchema.parse(request.params);
    const { users } = ManagersSchema.parse(request.body);
    return reply.send({ success: true, data: await this.service.deptSetManagers(request.accessToken!, id, users) });
  }
}
