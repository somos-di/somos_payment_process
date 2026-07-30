import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { clearSessionCookies, setSessionCookies } from '../middlewares/sessionCookies.js';
import type { AuthService } from '../services/authService.js';
import { getSettings } from '../settings.js';
import type { OAuthCallbackRoute } from '../types/http.js';

const LoginSchema = z.object(
  {
    email: z.string().email(),
    password: z.string().min(1)
  }
);

export class AuthController {
  constructor(private readonly service: AuthService) {
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.me = this.me.bind(this);
    this.oauthStart = this.oauthStart.bind(this);
    this.oauthCallback = this.oauthCallback.bind(this);
  }

  async oauthStart(_request: FastifyRequest, reply: FastifyReply) {
    const settings = getSettings();
    const redirectTo = `${settings.publicUrl}/api/v1/auth/callback`;
    const { url, pkce } = await this.service.oauthStart(redirectTo);

    reply.setCookie('sb_oauth', pkce, {
      httpOnly: true, sameSite: 'lax', secure: settings.cookieSecure, path: '/', maxAge: 600,
    });

    return reply.redirect(url);
  }

  async oauthCallback(request: FastifyRequest<OAuthCallbackRoute>, reply: FastifyReply) {
    const code = request.query.code;
    const pkce = request.cookies?.sb_oauth || '';

    reply.clearCookie('sb_oauth', { path: '/' });
    try {
      if (!code) throw new Error(request.query.error_description || 'sem code');
      const { token, refreshToken } = await this.service.oauthCallback(code, pkce);

      setSessionCookies(reply, token, refreshToken);

      return reply.redirect('/');
    } catch {

      return reply.redirect('/#/login?error=oauth');
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const { email, password } = LoginSchema.parse(request.body);
    const { token, refreshToken, user } = await this.service.login(email, password);

    setSessionCookies(reply, token, refreshToken);

    return reply.send({ success: true, data: { user } });
  }

  async logout(_request: FastifyRequest, reply: FastifyReply) {
    clearSessionCookies(reply);

    return reply.send({ success: true });
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    const data = await this.service.me(request.accessToken!, request.user!.id, request.user!.email);

    return reply.send({ success: true, data });
  }
}
