import Redis from 'ioredis';
import { getSettings } from '../settings.js';

// Cliente Redis OPCIONAL se REDIS_URL não estiver setado, devolve
// null (o CacheManager opera só com L1 in-process). Se estiver setado mas o Redis
// cair, os comandos rejeitam rápido (enableOfflineQueue:false) e o CacheManager
// degrada pra L1 — nunca derruba o request. Talvez eu substitua por um pub/sub de cache
// cross-process, mas não sei se vale a pena ainda
export function createRedisClient(): Redis | null {
  const { redisUrl } = getSettings();
  if (!redisUrl) return null;

  const client = new Redis(redisUrl, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  let loggedError = false;
  client.on('error', (err) => {
    if (!loggedError) { // loga 1x pra não spammar quando o Redis está fora
      loggedError = true;
      console.warn('[redis] indisponível, cache cai pra L1:', (err as Error).message);
    }
  });
  client.on('ready', () => { loggedError = false; });

  return client;
}
