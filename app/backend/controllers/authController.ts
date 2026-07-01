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
    this.oauthStart = this.oauthStart.bind(this);
    this.oauthCallback = this.oauthCallback.bind(this);
  }

  // inicia o SSO Microsoft. guarda o estado PKCE num cookie curto e redireciona
  // o browser pra tela de login da Microsoft.
  async oauthStart(_req: FastifyRequest, reply: FastifyReply) {
    const s = getSettings();
    const redirectTo = `${s.publicUrl}/api/v1/auth/callback`;
    const { url, pkce } = await this.service.oauthStart(redirectTo);

    reply.setCookie('sb_oauth', pkce, {
      httpOnly: true, sameSite: 'lax', secure: s.cookieSecure, path: '/', maxAge: 600,
    });

    return reply.redirect(url);
  }

  // callback do OAuth: troca o code pela sessão e seta o cookie de sessão.
  async oauthCallback(req: FastifyRequest<{ Querystring: { code?: string; error_description?: string } }>, reply: FastifyReply) {
    const code = req.query.code;
    const pkce = req.cookies?.sb_oauth || '';

    reply.clearCookie('sb_oauth', { path: '/' });
    try {
      if (!code) throw new Error(req.query.error_description || 'sem code');
      const { token } = await this.service.oauthCallback(code, pkce);

      reply.setCookie(getSettings().cookieName, token, cookieOpts());

      return reply.redirect('/');
    } catch {

      return reply.redirect('/#/login?error=oauth');
    }
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
