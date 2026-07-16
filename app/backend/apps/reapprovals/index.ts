
import type { FastifyInstance } from 'fastify';
import { getSettings } from '../../settings.js';
import { ReapprovalController } from './reapprovalController.js';
import { ReapprovalGateway } from './reapprovalGateway.js';
import { ReapprovalService } from './reapprovalService.js';
import { registerReapprovalRoutes } from './routes.js';

export function initReapprovalsApp(app: FastifyInstance): void {
  const gateway = new ReapprovalGateway(getSettings());
  const service = new ReapprovalService(gateway);
  const controller = new ReapprovalController(service);
  registerReapprovalRoutes(app, controller);
}
