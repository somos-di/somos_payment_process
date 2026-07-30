import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AdminService } from '../services/adminService.js';

const MembershipSchema = z.object({ user_usg: z.string().uuid(), group_usg: z.number().int() });
const UauSchema = z.object({ id_usr: z.string().uuid(), uau_user: z.string().max(120).nullable().optional() });
const PermSchema = z.object({ group: z.number().int(), company: z.string().min(1), building: z.string().min(1), kind: z.number().int() });
const GroupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(200).optional(),
  restrictLaunch: z.boolean().optional().default(false),
});

export class AdminController {
  constructor(private readonly service: AdminService) {
    this.users = this.users.bind(this);
    this.createGroup = this.createGroup.bind(this);
    this.addMembership = this.addMembership.bind(this);
    this.removeMembership = this.removeMembership.bind(this);
    this.setUau = this.setUau.bind(this);
    this.addPermission = this.addPermission.bind(this);
    this.removePermission = this.removePermission.bind(this);
  }

  async createGroup(request: FastifyRequest, reply: FastifyReply) {
    const group = GroupSchema.parse(request.body);
    const data = await this.service.createGroup(group.name, group.description ?? null, group.restrictLaunch);
    return reply.status(201).send({ success: true, data });
  }

  async addPermission(request: FastifyRequest, reply: FastifyReply) {
    const permission = PermSchema.parse(request.body);
    await this.service.addPermission(permission.group, permission.company, permission.building, permission.kind);
    return reply.send({ success: true });
  }
  async removePermission(request: FastifyRequest, reply: FastifyReply) {
    const permission = PermSchema.parse(request.body);
    await this.service.removePermission(permission.group, permission.company, permission.building, permission.kind);
    return reply.send({ success: true });
  }

  async setUau(request: FastifyRequest, reply: FastifyReply) {
    const { id_usr, uau_user } = UauSchema.parse(request.body);
    await this.service.setUauUser(id_usr, uau_user ?? null);
    return reply.send({ success: true });
  }

  async users(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.listUsers() });
  }
  async addMembership(request: FastifyRequest, reply: FastifyReply) {
    const { user_usg, group_usg } = MembershipSchema.parse(request.body);
    await this.service.addMembership(user_usg, group_usg);
    return reply.send({ success: true });
  }
  async removeMembership(request: FastifyRequest, reply: FastifyReply) {
    const { user_usg, group_usg } = MembershipSchema.parse(request.body);
    await this.service.removeMembership(user_usg, group_usg);
    return reply.send({ success: true });
  }
}
