// Env mínima p/ getSettings() nos testes. Valores FAKE — o Supabase/UAU só criam
// clientes preguiçosamente (não conectam), e sem REDIS_URL o cache fica desligado.
// Importar este módulo no topo dos testes que instanciam gateways/factory/app.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-test-key';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'service-test-key';
delete process.env.REDIS_URL; // garante cache desligado (sem conexão) nos testes
export {};
