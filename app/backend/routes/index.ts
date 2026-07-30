import type { FastifyInstance } from 'fastify';
import { initApps } from '../apps/index.js';
import type { ControllersContainer } from '../types/container.js';
import { registerAdminRoutes } from './admin.js';
import { registerProtectedAuthRoutes, registerPublicAuthRoutes } from './auth.js';
import { registerCatalogRoutes } from './catalog.js';
import { registerDataRoutes } from './data.js';
import { registerProcessesRoutes } from './processes.js';
import { registerSyncRoutes } from './sync.js';

export function registerPublicRoutes(app: FastifyInstance, controller_center: ControllersContainer): void {
  registerPublicAuthRoutes(app, controller_center.auth);
}

export function registerProtectedRoutes(app: FastifyInstance, controller_center: ControllersContainer): void {
  registerProtectedAuthRoutes(app, controller_center.auth);
  registerProcessesRoutes(app, controller_center.processes);
  registerSyncRoutes(app, controller_center.sync);
  registerDataRoutes(app, controller_center.data);
  registerAdminRoutes(app, controller_center.admin);
  registerCatalogRoutes(app, controller_center.catalog);
  initApps(app);
}
