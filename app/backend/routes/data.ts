import type { FastifyInstance } from 'fastify';
import type { DataController } from '../controllers/dataController.js';

// proxy genérico (protegido): o front nunca fala com o Supabase diretos
export function registerDataRoutes(app: FastifyInstance, data_center: DataController): void {
  app.post('/data/:resource', data_center.query);
  app.post('/rpc/:fn', data_center.rpc);
  app.post('/storage/upload', data_center.upload);
}
