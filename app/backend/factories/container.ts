import { CacheManager } from '../cache/cacheManager.js';
import { CacheWarmer } from '../cache/cacheWarmer.js';
import { AdminController } from '../controllers/adminController.js';
import { AuthController } from '../controllers/authController.js';
import { CatalogController } from '../controllers/catalogController.js';
import { DataController } from '../controllers/dataController.js';
import { ProcessesController } from '../controllers/processesController.js';
import { SyncController } from '../controllers/syncController.js';
import { createRedisClient } from '../gateways/redis.js';
import { UauGateway } from '../gateways/uau.js';
import { AdminService } from '../services/adminService.js';
import { AuthService } from '../services/authService.js';
import { CatalogService } from '../services/catalogService.js';
import { DataService } from '../services/dataService.js';
import { ProcessesService } from '../services/processesService.js';
import { UauSyncService } from '../services/syncUauData/sync.js';
import { UauIntegrationService } from '../services/uauIntegrationService.js';
import { getSettings } from '../settings.js';
import type { Container, ControllersContainer } from '../types/container.js';

export function createContainer(): Container {
  const settings = getSettings();
  const uauGateway = new UauGateway(settings);
  const cache = new CacheManager(createRedisClient(), settings.cacheTtlMs);
  const warmer = new CacheWarmer(cache);

  const processesService = new ProcessesService();
  const catalogService = new CatalogService(cache);
  const uauIntegrationService = new UauIntegrationService(catalogService);
  const uauSyncService = new UauSyncService(uauGateway, warmer);
  const authService = new AuthService();
  const dataService = new DataService(cache);
  const adminService = new AdminService();

  const controllers: ControllersContainer = {
    processes: new ProcessesController(processesService, uauIntegrationService),
    sync: new SyncController(uauSyncService),
    auth: new AuthController(authService),
    data: new DataController(dataService),
    admin: new AdminController(adminService),
    catalog: new CatalogController(catalogService),
  };
  return { controllers, authService, warmer };
}
