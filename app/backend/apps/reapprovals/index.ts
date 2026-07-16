import type { FastifyInstance } from 'fastify';
import { getSettings } from '../../settings.js';
import { ReapprovalController } from './reapprovalController.js';
import { ReapprovalGateway } from './reapprovalGateway.js';
import { ReapprovalService } from './reapprovalService.js';
import { registerReapprovalRoutes } from './routes.js';

// Mini app REAPROVAÇÕES (admin): DI própria (gateway n8n + service + controller),
// config do getSettings central (um .env só). Rotas gated a requireAdmin.
export function initReapprovalsApp(app: FastifyInstance): void {
  const gateway = new ReapprovalGateway(getSettings());
  const service = new ReapprovalService(gateway);
  const controller = new ReapprovalController(service);
  registerReapprovalRoutes(app, controller);
}
