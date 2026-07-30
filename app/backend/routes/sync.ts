import type { FastifyInstance } from 'fastify';
import type { SyncController } from '../controllers/syncController.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

export function registerSyncRoutes(app: FastifyInstance, sync_center: SyncController): void {
  const admin = { preHandler: requireAdmin };
  app.post('/sync', admin, sync_center.syncAll);
  app.post('/sync/:id', admin, sync_center.syncOne);
}
