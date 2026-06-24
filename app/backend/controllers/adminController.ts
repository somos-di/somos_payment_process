import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AdminService } from '../services/adminService.js';

const MembershipSchema = z.object({ user_usg: z.string().uuid(), group_usg: z.number().int() });

export class AdminController {
  constructor(private readonly service: AdminService) {
    this.users = this.users.bind(this);
    this.addMembership = this.addMembership.bind(this);
    this.removeMembership = this.removeMembership.bind(this);
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
