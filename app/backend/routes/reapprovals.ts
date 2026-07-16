import type { FastifyInstance } from 'fastify';
import type { ReapprovalController } from '../controllers/reapprovalController.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

// Mini app de REAPROVAÇÃO — SOMENTE admin (requireAdmin, além do requireAuth do plugin).
export function registerReapprovalRoutes(app: FastifyInstance, reapproval_center: ReapprovalController): void {
  app.post('/reapprovals', { preHandler: requireAdmin }, reapproval_center.create);
}
