import type { FastifyReply } from 'fastify';
import { getSettings } from '../settings.js';

// COOKIES DE SESSÃO (fonte única — usada por login, OAuth, refresh e logout).
// Sessão longa: o usuário fica logado enquanto usar o app. A segurança NÃO cai —
// o access token (JWT) continua curto e é renovado pelo refresh token no
// requireAuth; estes cookies só definem por quanto tempo o navegador guarda as
// credenciais. Ambos httpOnly (o front nunca lê o token).
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

// nome do cookie do refresh token: derivado do cookie de sessão (ex.: pp_session_r)
export function refreshCookieName(): string {
  return getSettings().cookieName + '_r';
}

function baseOpts() {
  const s = getSettings();
  return { httpOnly: true as const, sameSite: 'lax' as const, secure: s.cookieSecure, path: '/', maxAge: SESSION_MAX_AGE };
}

// grava access token + refresh token. refreshToken vazio => não seta o cookie de
// refresh (mantém o comportamento defensivo; login/OAuth sempre trazem um).
export function setSessionCookies(reply: FastifyReply, token: string, refreshToken?: string): void {
  reply.setCookie(getSettings().cookieName, token, baseOpts());
  if (refreshToken) reply.setCookie(refreshCookieName(), refreshToken, baseOpts());
}

export function clearSessionCookies(reply: FastifyReply): void {
  reply.clearCookie(getSettings().cookieName, { path: '/' });
  reply.clearCookie(refreshCookieName(), { path: '/' });
}
