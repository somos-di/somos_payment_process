import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../services/authService.js';
import { getSettings } from '../settings.js';

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

function cookieOpts() {
  const s = getSettings();
  return {
    httpOnly: true, sameSite: 'lax' as const, secure: s.cookieSecure,
    path: '/', maxAge: 60 * 60 * 8, // 8h
  };
}

export class AuthController {
  constructor(private readonly service: AuthService) {
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.me = this.me.bind(this);
  }

  async login(req: FastifyRequest, reply: FastifyReply) {
    const { email, password } = LoginSchema.parse(req.body);
    const { token, user } = await this.service.login(email, password);
    reply.setCookie(getSettings().cookieName, token, cookieOpts());
    return reply.send({ success: true, data: { user } });
  }

  async logout(req: FastifyRequest, reply: FastifyReply) {
    reply.clearCookie(getSettings().cookieName, { path: '/' });
    return reply.send({ success: true });
  }

  async me(req: FastifyRequest, reply: FastifyReply) {
    const data = await this.service.me(req.accessToken!, req.user!.id, req.user!.email);
    return reply.send({ success: true, data });
  }
}
