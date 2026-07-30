import type { FastifyReply } from 'fastify';
import { getSettings } from '../settings.js';

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export function refreshCookieName(): string {
  return getSettings().cookieName + '_r';
}

function baseCookieOptions() {
  const settings = getSettings();
  return { httpOnly: true as const, sameSite: 'lax' as const, secure: settings.cookieSecure, path: '/', maxAge: SESSION_MAX_AGE };
}

export function setSessionCookies(reply: FastifyReply, token: string, refreshToken?: string): void {
  reply.setCookie(getSettings().cookieName, token, baseCookieOptions());
  if (refreshToken) reply.setCookie(refreshCookieName(), refreshToken, baseCookieOptions());
}

export function clearSessionCookies(reply: FastifyReply): void {
  reply.clearCookie(getSettings().cookieName, { path: '/' });
  reply.clearCookie(refreshCookieName(), { path: '/' });
}
