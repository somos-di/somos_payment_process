import type { FastifyRequest } from 'fastify';
import { AppError, UnauthorizedError } from '../errors.js';
import { adminClient } from '../gateways/supabase.js';

// Roda DEPOIS do requireAuth (req.user já setado). Verifica payment.users.is_admin
// pelo service_role — gate de verdade no servidor; o front só esconde o menu.
export async function requireAdmin(request: FastifyRequest): Promise<void> {
  const id = request.user?.id;
  if (!id) throw new UnauthorizedError();
  const { data, error } = await adminClient()
    .from('users').select('is_admin').eq('id_usr', id).maybeSingle();
  if (error) throw new AppError(error.message, 400, 'supabase');
  if (!data?.is_admin) throw new AppError('Acesso restrito a administradores', 403, 'forbidden');
}
