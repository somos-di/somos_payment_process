import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../middlewares/requireAdmin.js';
import type { ReapprovalController } from './reapprovalController.js';

export function registerReapprovalRoutes(app: FastifyInstance, reapproval_center: ReapprovalController): void {
  const admin = { preHandler: requireAdmin };
  app.get('/reapprovals', admin, reapproval_center.list);
  app.post('/reapprovals', admin, reapproval_center.create);
}
