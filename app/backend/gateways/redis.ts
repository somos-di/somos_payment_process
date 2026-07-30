import Redis from 'ioredis';
import { getSettings } from '../settings.js';

export function createRedisClient(): Redis | null {
  const { redisUrl } = getSettings();
  if (!redisUrl) return null;

  const client = new Redis(redisUrl, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  let loggedError = false;
  client.on('error', (error) => {
    if (!loggedError) {
      loggedError = true;
      console.warn('[redis] indisponível, cache cai pra L1:', (error as Error).message);
    }
  });
  client.on('ready', () => { loggedError = false; });

  return client;
}
