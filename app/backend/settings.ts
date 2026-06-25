// Validação de env (lança no boot se faltar). Singleton via getSettings().
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env ausente: ${name}`);
  return v;
}

// TRUST_PROXY: 'true'/'false' (booleano) ou número de hops (ex.: '2' p/ ngrok+nginx).
// Pinar o nº de hops evita spoof de X-Forwarded-For no req.ip. Default true (dev).
function parseTrustProxy(v: string | undefined): boolean | number {
  if (v == null || v === '' || v === 'true') return true;
  if (v === 'false') return false;
  const n = Number(v);
  return Number.isFinite(n) ? n : true;
}

export interface AppSettings {
  port: number;
  host: string;
  corsOrigin: string;
  trustProxy: boolean | number | string;  // hops confiáveis p/ derivar req.ip do XFF
  publicUrl: string;   // origem pública (ex.: https://pagamentos.ngrok.dev) p/ redirect do OAuth
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  schema: string;
  cookieName: string;
  cookieSecure: boolean;
  attachmentsBucket: string;
  redisUrl: string | null;   // null => cache só L1 (in-process)
  cacheTtlMs: number;
  uau: {
    baseUrl: string;
    user: string;
    password: string;
    xIntegration: string;
    timeoutMs: number;
  };
}

let _s: AppSettings | null = null;

export function getSettings(): AppSettings {
  if (_s) return _s;
  _s = {
    port: Number(process.env.PORT || 4000),
    host: process.env.HOST || '0.0.0.0',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    publicUrl: process.env.PUBLIC_URL || (process.env.CORS_ORIGIN || '').split(',')[0].trim() || '',
    supabaseUrl: req('SUPABASE_URL'),
    supabaseAnonKey: req('SUPABASE_ANON_KEY'),
    supabaseServiceKey: req('SUPABASE_SERVICE_KEY'),
    schema: process.env.SUPABASE_SCHEMA || 'payment',
    cookieName: process.env.SESSION_COOKIE || 'pp_session',
    cookieSecure: (process.env.COOKIE_SECURE || 'false') === 'true',
    attachmentsBucket: process.env.ATTACHMENTS_BUCKET || 'attachments',
    redisUrl: process.env.REDIS_URL || null,
    cacheTtlMs: Number(process.env.CACHE_TTL_MS || 600000), // 10 min

    uau: {
      baseUrl: process.env.UAU_BASE_URL || '',
      user: process.env.UAU_USER || '',
      password: process.env.UAU_PASSWORD || '',
      xIntegration: process.env.UAU_X_INTEGRATION || '',
      timeoutMs: Number(process.env.UAU_TIMEOUT_MS || 30000),
    },
  };
  return _s;
}
