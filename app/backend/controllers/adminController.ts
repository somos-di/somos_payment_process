import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AdminService } from '../services/adminService.js';

const MembershipSchema = z.object({ user_usg: z.string().uuid(), group_usg: z.number().int() });
const UauSchema = z.object({ id_usr: z.string().uuid(), uau_user: z.string().max(120).nullable().optional() });
const PermSchema = z.object({ group: z.number().int(), company: z.string().min(1), building: z.string().min(1), kind: z.number().int() });

export class AdminController {
  constructor(private readonly service: AdminService) {
    this.users = this.users.bind(this);
    this.addMembership = this.addMembership.bind(this);
    this.removeMembership = this.removeMembership.bind(this);
    this.setUau = this.setUau.bind(this);
    this.addPermission = this.addPermission.bind(this);
    this.removePermission = this.removePermission.bind(this);
  }

  async addPermission(req: FastifyRequest, reply: FastifyReply) {
    const p = PermSchema.parse(req.body);
    await this.service.addPermission(p.group, p.company, p.building, p.kind);
    return reply.send({ success: true });
  }
  async removePermission(req: FastifyRequest, reply: FastifyReply) {
    const p = PermSchema.parse(req.body);
    await this.service.removePermission(p.group, p.company, p.building, p.kind);
    return reply.send({ success: true });
  }

  async setUau(req: FastifyRequest, reply: FastifyReply) {
    const { id_usr, uau_user } = UauSchema.parse(req.body);
    await this.service.setUauUser(id_usr, uau_user ?? null);
    return reply.send({ success: true });
  }

  async users(_req: FastifyRequest, reply: FastifyReply) {
    return reply.send({ success: true, data: await this.service.listUsers() });
  }
  async addMembership(req: FastifyRequest, reply: FastifyReply) {
    const { user_usg, group_usg } = MembershipSchema.parse(req.body);
    await this.service.addMembership(user_usg, group_usg);
    return reply.send({ success: true });
  }
  async removeMembership(req: FastifyRequest, reply: FastifyReply) {
    const { user_usg, group_usg } = MembershipSchema.parse(req.body);
    await this.service.removeMembership(user_usg, group_usg);
    return reply.send({ success: true });
  }
}
