import type { CacheWarmer } from '../cache/cacheWarmer.js';
import type { AdminController } from '../controllers/adminController.js';
import type { AuthController } from '../controllers/authController.js';
import type { CatalogController } from '../controllers/catalogController.js';
import type { DataController } from '../controllers/dataController.js';
import type { MeasurementController } from '../controllers/measurementController.js';
import type { ProcessesController } from '../controllers/processesController.js';
import type { SyncController } from '../controllers/syncController.js';
import type { AuthService } from '../services/authService.js';

export interface ControllersContainer {
  processes: ProcessesController;
  sync: SyncController;
  auth: AuthController;
  data: DataController;
  admin: AdminController;
  catalog: CatalogController;
  measurement: MeasurementController;
}

export interface Container {
  controllers: ControllersContainer;
  authService: AuthService;
  warmer: CacheWarmer;
}
