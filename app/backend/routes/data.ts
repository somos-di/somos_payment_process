import type { FastifyInstance } from 'fastify';
import type { DataController } from '../controllers/dataController.js';

// proxy genérico (protegido): o front nunca fala com o Supabase diretos
export function registerDataRoutes(app: FastifyInstance, c: DataController): void {
  app.post('/data/:resource', c.query);
  app.post('/rpc/:fn', c.rpc);
  app.post('/storage/upload', c.upload);
}
