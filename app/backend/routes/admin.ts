import type { FastifyInstance } from 'fastify';
import type { AdminController } from '../controllers/adminController.js';

// Administração protegida: usuários + vínculos usuário - grupo.
export function registerAdminRoutes(app: FastifyInstance, c: AdminController): void {
  app.get('/admin/users', c.users);
  app.post('/admin/users-group', c.addMembership);
  app.post('/admin/users-group/delete', c.removeMembership);
}
