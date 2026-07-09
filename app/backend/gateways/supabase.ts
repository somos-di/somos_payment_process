import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../errors.js';
import { getSettings } from '../settings.js';

type Client = SupabaseClient<any, any, any>;

export async function unwrap<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new AppError((error as { message?: string }).message || 'Erro Supabase', 400, 'supabase');
  return data;
}


export function adminClient(): Client {
  const s = getSettings();
  return createClient(s.supabaseUrl, s.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: s.schema },
  });
}

export function anonClient(): Client {
  const s = getSettings();
  return createClient(s.supabaseUrl, s.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: s.schema },
  });
}

export function userClient(token: string): Client {
  const s = getSettings();
  return createClient(s.supabaseUrl, s.supabaseAnonKey, {
    db: { schema: s.schema },
    accessToken: async () => token,
  });
}
