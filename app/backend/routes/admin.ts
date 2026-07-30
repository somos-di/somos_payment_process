import type { FastifyInstance } from 'fastify';
import type { AdminController } from '../controllers/adminController.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

export function registerAdminRoutes(app: FastifyInstance, admin_center: AdminController): void {
  const admin = { preHandler: requireAdmin };
  app.get('/admin/users', admin, admin_center.users);
  app.post('/admin/groups', admin, admin_center.createGroup);
  app.post('/admin/users-group', admin, admin_center.addMembership);
  app.post('/admin/users-group/delete', admin, admin_center.removeMembership);
  app.post('/admin/users/uau', admin, admin_center.setUau);
  app.post('/admin/permissions', admin, admin_center.addPermission);
  app.post('/admin/permissions/delete', admin, admin_center.removePermission);
}
