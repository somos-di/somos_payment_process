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
import type { ControllersContainer } from '../routes/index.js';
import { AdminService } from '../services/adminService.js';
import { AuthService } from '../services/authService.js';
import { CatalogService } from '../services/catalogService.js';
import { DataService } from '../services/dataService.js';
import { ProcessesService } from '../services/processesService.js';
import { UauSyncService } from '../services/syncUauData/sync.js';
import { UauIntegrationService } from '../services/uauIntegrationService.js';
import { getSettings } from '../settings.js';

export interface Container {
  controllers: ControllersContainer;
  warmer: CacheWarmer;   // usado no boot (main.ts) para aquecer o cache
}

// instancia gateways, services e controllers. quaisquer novas entidades entram aqui
export function createContainer(): Container {
  const settings = getSettings();
  const uau = new UauGateway(settings);
  const cache = new CacheManager(createRedisClient(), settings.cacheTtlMs);
  const warmer = new CacheWarmer(cache);

  const processesService = new ProcessesService();
  const uauIntegrationService = new UauIntegrationService();
  const uauSyncService = new UauSyncService(uau, warmer);
  const authService = new AuthService();
  const dataService = new DataService(cache);
  const adminService = new AdminService();
  const catalogService = new CatalogService(cache);

  const controllers: ControllersContainer = {
    processes: new ProcessesController(processesService, uauIntegrationService),
    sync: new SyncController(uauSyncService),
    auth: new AuthController(authService),
    data: new DataController(dataService),
    admin: new AdminController(adminService),
    catalog: new CatalogController(catalogService),
  };
  return { controllers, warmer };
}
