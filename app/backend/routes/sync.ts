import type { FastifyInstance } from 'fastify';
import type { SyncController } from '../controllers/syncController.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

// Sincronização (truncate + reinsert dos espelhos via service_role): só admin.
export function registerSyncRoutes(app: FastifyInstance, sync_center: SyncController): void {
  const admin = { preHandler: requireAdmin };
  app.post('/sync', admin, sync_center.syncAll);       // sincroniza todos os espelhos do catálogo
  app.post('/sync/:id', admin, sync_center.syncOne);   // sincroniza 1 (por id_uat)
}
