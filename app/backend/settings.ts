import type { AppSettings } from './types/settings.js';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Env ausente: ${name}`);
  return value;
}

function parseTrustProxy(value: string | undefined): boolean | number {
  if (value == null || value === '' || value === 'true') return true;
  if (value === 'false') return false;
  const parsedNumber = Number(value);
  return Number.isFinite(parsedNumber) ? parsedNumber : true;
}

let cachedSettings: AppSettings | null = null;

export function getSettings(): AppSettings {
  if (cachedSettings) return cachedSettings;
  cachedSettings = {
    port: Number(process.env.PORT || 4000),
    host: process.env.HOST || '0.0.0.0',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    publicUrl: process.env.PUBLIC_URL || (process.env.CORS_ORIGIN || '').split(',')[0].trim() || '',
    supabaseUrl: requiredEnv('SUPABASE_URL'),
    supabaseAnonKey: requiredEnv('SUPABASE_ANON_KEY'),
    supabaseServiceKey: requiredEnv('SUPABASE_SERVICE_KEY'),
    schema: process.env.SUPABASE_SCHEMA || 'payment',
    cookieName: process.env.SESSION_COOKIE || 'pp_session',
    cookieSecure: (process.env.COOKIE_SECURE || 'false') === 'true',
    attachmentsBucket: process.env.ATTACHMENTS_BUCKET || 'attachments',
    redisUrl: process.env.REDIS_URL || null,
    cacheTtlMs: Number(process.env.CACHE_TTL_MS || 86400000),

    uau: {
      baseUrl: process.env.UAU_BASE_URL || '',
      user: process.env.UAU_USER || '',
      password: process.env.UAU_PASSWORD || '',
      xIntegration: process.env.UAU_X_INTEGRATION || '',
      timeoutMs: Number(process.env.UAU_TIMEOUT_MS || 30000),
    },
    n8nBaseUrl: process.env.N8N_BASE_URL || '',
    integration: { webhookEndpoint: process.env.INTEGRATION_WEBHOOK_ENDPOINT || '' },
    reapproval: { workflowEndPoint: process.env.REAPROVAL_WORKFLOW_ENDPOINT || '' },
  };
  return cachedSettings;
}
