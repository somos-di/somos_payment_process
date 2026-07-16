import type { FastifyInstance } from 'fastify';
import { initApps } from '../apps/index.js';
import type { AdminController } from '../controllers/adminController.js';
import type { AuthController } from '../controllers/authController.js';
import type { CatalogController } from '../controllers/catalogController.js';
import type { DataController } from '../controllers/dataController.js';
import type { ProcessesController } from '../controllers/processesController.js';
import type { SyncController } from '../controllers/syncController.js';
import { registerAdminRoutes } from './admin.js';
import { registerProtectedAuthRoutes, registerPublicAuthRoutes } from './auth.js';
import { registerCatalogRoutes } from './catalog.js';
import { registerDataRoutes } from './data.js';
import { registerProcessesRoutes } from './processes.js';
import { registerSyncRoutes } from './sync.js';

// Controllers do CORE (pagamento). Os MINI APPS (comissões, reaprovações) têm DI e
// rotas próprias em apps/<app>/ e são registrados via initApps — não entram aqui.
export interface ControllersContainer {
  processes: ProcessesController;
  sync: SyncController;
  auth: AuthController;
  data: DataController;
  admin: AdminController;
  catalog: CatalogController;
}

// públicas sem requireAuth — login/logout do Supabase Auth ficam no backend
export function registerPublicRoutes(app: FastifyInstance, controller_center: ControllersContainer): void {
  registerPublicAuthRoutes(app, controller_center.auth);
}

// protegidas — main.ts registra dentro de um plugin com preHandler requireAuth
export function registerProtectedRoutes(app: FastifyInstance, controller_center: ControllersContainer): void {
  registerProtectedAuthRoutes(app, controller_center.auth);
  registerProcessesRoutes(app, controller_center.processes);
  registerSyncRoutes(app, controller_center.sync);
  registerDataRoutes(app, controller_center.data);
  registerAdminRoutes(app, controller_center.admin);
  registerCatalogRoutes(app, controller_center.catalog);
  initApps(app);   // MINI APPS (comissões, reaprovações): cada um monta sua DI + rotas
}
