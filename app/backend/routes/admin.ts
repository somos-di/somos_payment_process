import type { FastifyInstance } from 'fastify';
import type { AdminController } from '../controllers/adminController.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

// Administração protegida: usuários + vínculos usuário - grupo.
// requireAdmin (além do requireAuth do plugin) restringe a admins no SERVIDOR.
export function registerAdminRoutes(app: FastifyInstance, c: AdminController): void {
  const admin = { preHandler: requireAdmin };
  app.get('/admin/users', admin, c.users);
  app.post('/admin/users-group', admin, c.addMembership);
  app.post('/admin/users-group/delete', admin, c.removeMembership);
}
