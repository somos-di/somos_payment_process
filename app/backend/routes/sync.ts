import type { FastifyInstance } from 'fastify';
import type { SyncController } from '../controllers/syncController.js';

export function registerSyncRoutes(app: FastifyInstance, c: SyncController): void {
  app.post('/sync', c.syncAll);       // sincroniza todos os espelhos do catálogo
  app.post('/sync/:id', c.syncOne);   // sincroniza 1 (por id_uat)
}
