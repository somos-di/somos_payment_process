import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSettings } from '../settings.js';

type Client = SupabaseClient<any, any, any>;

// admin: service_role (ignora RLS) — só para operações privilegiadas (ex.: integração UAU).

export function adminClient(): Client {
  const s = getSettings();
  return createClient(s.supabaseUrl, s.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: s.schema },
  });
}

// anon sem privilégio
export function anonClient(): Client {
  const s = getSettings();
  return createClient(s.supabaseUrl, s.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: s.schema },
  });
}

// userClient: age EM NOME do usuário. Usa a opção `accessToken` (forma canônica do
// supabase-js v2 atualmente) p/ que qualquer request leve o jwt do usuário no Authorization —
// assim auth.uid() resolve no Postgres e a RLS vale. (global.headers era sobrescrito
// pela apikey em algumas requests
export function userClient(token: string): Client {
  const s = getSettings();
  return createClient(s.supabaseUrl, s.supabaseAnonKey, {
    db: { schema: s.schema },
    accessToken: async () => token,
  });
}
