import type { FastifyInstance } from 'fastify';
import type { ReapprovalController } from '../controllers/reapprovalController.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

// Mini app de REAPROVAÇÃO — SOMENTE admin (requireAdmin, além do requireAuth do plugin).
export function registerReapprovalRoutes(app: FastifyInstance, reapproval_center: ReapprovalController): void {
  const admin = { preHandler: requireAdmin };
  app.get('/reapprovals', admin, reapproval_center.list);      // histórico (admin)
  app.post('/reapprovals', admin, reapproval_center.create);   // envia + registra (admin)
}
