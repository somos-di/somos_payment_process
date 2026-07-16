import type { FastifyInstance } from 'fastify';
import type { AdminController } from '../controllers/adminController.js';
import type { AuthController } from '../controllers/authController.js';
import type { CatalogController } from '../controllers/catalogController.js';
import type { CommissionsController } from '../controllers/commissionsController.js';
import type { DataController } from '../controllers/dataController.js';
import type { ProcessesController } from '../controllers/processesController.js';
import type { ReapprovalController } from '../controllers/reapprovalController.js';
import type { SyncController } from '../controllers/syncController.js';
import { registerAdminRoutes } from './admin.js';
import { registerProtectedAuthRoutes, registerPublicAuthRoutes } from './auth.js';
import { registerCatalogRoutes } from './catalog.js';
import { registerCommissionsRoutes } from './commissions.js';
import { registerDataRoutes } from './data.js';
import { registerProcessesRoutes } from './processes.js';
import { registerReapprovalRoutes } from './reapprovals.js';
import { registerSyncRoutes } from './sync.js';

export interface ControllersContainer {
  processes: ProcessesController;
  sync: SyncController;
  auth: AuthController;
  data: DataController;
  admin: AdminController;
  catalog: CatalogController;
  commissions: CommissionsController;
  reapproval: ReapprovalController;
}

// públicas sem requireAuth — login/logout do Supabase Auth ficam no backend
export function registerPublicRoutes(app: FastifyInstance, controller_center: ControllersContainer): void {
  registerPublicAuthRoutes(app, controller_center.auth);
}

// protegidas — main.ts registra dentro de um plugin com preHandler requireAuthm
export function registerProtectedRoutes(app: FastifyInstance, controller_center: ControllersContainer): void {
  registerProtectedAuthRoutes(app, controller_center.auth);
  registerProcessesRoutes(app, controller_center.processes);
  registerCommissionsRoutes(app, controller_center.commissions);
  registerSyncRoutes(app, controller_center.sync);
  registerDataRoutes(app, controller_center.data);
  registerAdminRoutes(app, controller_center.admin);
  registerCatalogRoutes(app, controller_center.catalog);
  registerReapprovalRoutes(app, controller_center.reapproval);
}
