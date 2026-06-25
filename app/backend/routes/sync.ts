import type { FastifyInstance } from 'fastify';
import type { SyncController } from '../controllers/syncController.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

// Sincronização (truncate + reinsert dos espelhos via service_role): só admin.
export function registerSyncRoutes(app: FastifyInstance, c: SyncController): void {
  const admin = { preHandler: requireAdmin };
  app.post('/sync', admin, c.syncAll);       // sincroniza todos os espelhos do catálogo
  app.post('/sync/:id', admin, c.syncOne);   // sincroniza 1 (por id_uat)
}
