import type { FastifyInstance } from 'fastify';
import { initCommissionsApp } from './commissions/index.js';
import { initReapprovalsApp } from './reapprovals/index.js';

// Ponto único dos MINI APPS. Cada app tem sua stack própria em apps/<app>/ e um init
// autocontido (DI + rotas). initApps é chamado dentro do plugin protegido do main.
// Para adicionar um novo mini app: crie apps/<novo>/ com seu init e chame aqui.
export function initApps(app: FastifyInstance): void {
  initCommissionsApp(app);
  initReapprovalsApp(app);
}
