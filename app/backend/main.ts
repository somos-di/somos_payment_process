import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { createContainer } from './factories/container.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { requireAuth } from './middlewares/requireAuth.js';
import { registerProtectedRoutes, registerPublicRoutes } from './routes/index.js';
import { getSettings } from './settings.js';

const settings = getSettings();
const { controllers, authService, warmer } = createContainer();

const app = Fastify({ logger: { level: 'info' }, trustProxy: settings.trustProxy, bodyLimit: 70 * 1024 * 1024 });

const corsOrigins = settings.corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean).filter((origin) => origin !== '*');
await app.register(cors, { origin: corsOrigins.length ? corsOrigins : false, credentials: true });
await app.register(cookie);

await app.register(rateLimit, {
  global: true,
  max: 200,
  timeWindow: '1 minute',
  keyGenerator: (request) => {
    const sessionToken = request.cookies?.[settings.cookieName];
    if (sessionToken) {
      try { return JSON.parse(Buffer.from(sessionToken.split('.')[1], 'base64').toString()).sub || request.ip; } catch { }
    }
    return request.ip;
  },
});

app.setErrorHandler(errorHandler);
app.get('/health', async () => ({ ok: true }));

await app.register(async (scopedApp) => { registerPublicRoutes(scopedApp, controllers); }, { prefix: '/api/v1' });

await app.register(async (scopedApp) => {
  scopedApp.addHook('preHandler', requireAuth(authService));
  registerProtectedRoutes(scopedApp, controllers);
}, { prefix: '/api/v1' });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutdown'); try { await app.close(); } catch (error) { app.log.error(error); } process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

app.listen({ port: settings.port, host: settings.host })
  .then(() => {
    app.log.info(`backend on http://${settings.host}:${settings.port}`);
    warmer.warmAll()
      .then(() => app.log.info('cache aquecido no boot'))
      .catch((error) => app.log.warn({ err: error }, 'falha ao aquecer o cache no boot'));
  })
  .catch((error) => { app.log.error(error); process.exit(1); });
