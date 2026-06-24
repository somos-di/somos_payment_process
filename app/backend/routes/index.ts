import type { FastifyInstance } from 'fastify';
import type { AdminController } from '../controllers/adminController.js';
import type { AuthController } from '../controllers/authController.js';
import type { DataController } from '../controllers/dataController.js';
import type { ProcessesController } from '../controllers/processesController.js';
import type { SyncController } from '../controllers/syncController.js';
import { registerAdminRoutes } from './admin.js';
import { registerProtectedAuthRoutes, registerPublicAuthRoutes } from './auth.js';
import { registerDataRoutes } from './data.js';
import { registerProcessesRoutes } from './processes.js';
import { registerSyncRoutes } from './sync.js';

export interface ControllersContainer {
  processes: ProcessesController;
  sync: SyncController;
  auth: AuthController;
  data: DataController;
  admin: AdminController;
}

// públicas sem requireAuth — login/logout do Supabase Auth ficam no backend
export function registerPublicRoutes(app: FastifyInstance, c: ControllersContainer): void {
  registerPublicAuthRoutes(app, c.auth);
}

// protegidas — main.ts registra dentro de um plugin com preHandler requireAuthm
export function registerProtectedRoutes(app: FastifyInstance, c: ControllersContainer): void {
  registerProtectedAuthRoutes(app, c.auth);
  registerProcessesRoutes(app, c.processes);
  registerSyncRoutes(app, c.sync);
  registerDataRoutes(app, c.data);
  registerAdminRoutes(app, c.admin);
}
