import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../errors.js';
import { adminClient } from '../gateways/supabase.js';
import { getSettings } from '../settings.js';
import type { SessionRefresher } from '../types/auth.js';
import { clearSessionCookies, refreshCookieName, setSessionCookies } from './sessionCookies.js';

export function requireAuth(sessionRefresher: SessionRefresher) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = request.cookies?.[getSettings().cookieName] || '';

    if (token) {
      const { data, error } = await adminClient().auth.getUser(token);
      if (!error && data.user) {
        request.user = { id: data.user.id, email: data.user.email || '' };
        request.accessToken = token;
        return;
      }
    }

    const refreshToken = request.cookies?.[refreshCookieName()] || '';
    if (refreshToken) {
      try {
        const session = await sessionRefresher.refresh(refreshToken);
        setSessionCookies(reply, session.token, session.refreshToken);
        request.user = session.user;
        request.accessToken = session.token;
        return;
      } catch { }
    }

    clearSessionCookies(reply);
    throw new UnauthorizedError();
  };
}
