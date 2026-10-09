import type { FastifyRequest } from 'fastify';
import { AppError } from '../errors.js';

const API_PREFIX = '/api/v1';
const PASSWORD_ROUTES: readonly string[] = ['/auth/me', '/auth/password'];
const REPORT_ROUTES: readonly string[] = [...PASSWORD_ROUTES, '/analytics-reports', '/analytics-reports/:id/file'];

export function reportViewerRoutes(mustChangePassword: boolean): readonly string[] {
  return mustChangePassword ? PASSWORD_ROUTES : REPORT_ROUTES;
}

export async function restrictReportViewers(request: FastifyRequest): Promise<void> {
  const user = request.user;
  if (!user?.reportViewer) return;
  const route = (request.routeOptions.url ?? '').replace(API_PREFIX, '');
  if (reportViewerRoutes(user.mustChangePassword).includes(route)) return;
  const message = user.mustChangePassword
    ? 'Troque a senha temporária antes de continuar.'
    : 'Seu acesso é só aos relatórios.';
  throw new AppError(message, 403, 'forbidden');
}
