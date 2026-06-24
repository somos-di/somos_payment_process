import type { FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../errors.js';
import { adminClient } from '../gateways/supabase.js';
import { getSettings } from '../settings.js';

// Valida o JWT do Supabase 
export async function requireAuth(request: FastifyRequest): Promise<void> {
  const token = request.cookies?.[getSettings().cookieName] || '';
  if (!token) throw new UnauthorizedError();
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new UnauthorizedError('Sessão inválida');
  request.user = { id: data.user.id, email: data.user.email || '' };
  request.accessToken = token;
}
