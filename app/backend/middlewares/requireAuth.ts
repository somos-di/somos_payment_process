import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../errors.js';
import { adminClient } from '../gateways/supabase.js';
import type { Session } from '../services/authService.js';
import { getSettings } from '../settings.js';
import { clearSessionCookies, refreshCookieName, setSessionCookies } from './sessionCookies.js';

// só o que o middleware precisa do AuthService (ISP): renovar a sessão.
interface SessionRefresher {
  refresh(refreshToken: string): Promise<Session>;
}

// Valida o JWT do Supabase e MANTÉM a sessão aberta: se o access token expirou/sumiu
// mas há refresh token, renova de forma transparente e regrava os cookies — o usuário
// não é deslogado. Factory (DI) para receber o AuthService sem acoplar ao container.
export function requireAuth(auth: SessionRefresher) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = request.cookies?.[getSettings().cookieName] || '';

    // 1) access token válido -> segue direto
    if (token) {
      const { data, error } = await adminClient().auth.getUser(token);
      if (!error && data.user) {
        request.user = { id: data.user.id, email: data.user.email || '' };
        request.accessToken = token;
        return;
      }
    }

    // 2) access token ausente/expirado -> tenta renovar pelo refresh token
    const refreshToken = request.cookies?.[refreshCookieName()] || '';
    if (refreshToken) {
      try {
        const s = await auth.refresh(refreshToken);
        setSessionCookies(reply, s.token, s.refreshToken);
        request.user = s.user;
        request.accessToken = s.token;
        return;
      } catch { /* refresh inválido/expirado -> cai no 401 abaixo */ }
    }

    // 3) sem credenciais renováveis -> limpa e nega
    clearSessionCookies(reply);
    throw new UnauthorizedError();
  };
}
