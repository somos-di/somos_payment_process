import { AdminController } from '../controllers/adminController.js';
import { AuthController } from '../controllers/authController.js';
import { DataController } from '../controllers/dataController.js';
import { ProcessesController } from '../controllers/processesController.js';
import { SyncController } from '../controllers/syncController.js';
import { UauGateway } from '../gateways/uau.js';
import type { ControllersContainer } from '../routes/index.js';
import { AdminService } from '../services/adminService.js';
import { AuthService } from '../services/authService.js';
import { DataService } from '../services/dataService.js';
import { ProcessesService } from '../services/processesService.js';
import { UauSyncService } from '../services/syncUauData/sync.js';
import { getSettings } from '../settings.js';

export interface Container {
  controllers: ControllersContainer;
}

// instancia gateways, services e controllers. Novas entidades entram aqui
export function createContainer(): Container {
  const uau = new UauGateway(getSettings());

  const processesService = new ProcessesService();
  const uauSyncService = new UauSyncService(uau);
  const authService = new AuthService();
  const dataService = new DataService();
  const adminService = new AdminService();

  const controllers: ControllersContainer = {
    processes: new ProcessesController(processesService),
    sync: new SyncController(uauSyncService),
    auth: new AuthController(authService),
    data: new DataController(dataService),
    admin: new AdminController(adminService),
  };
  return { controllers };
}
