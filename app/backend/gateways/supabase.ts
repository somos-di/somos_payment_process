import { createClient } from '@supabase/supabase-js';
import { AppError } from '../errors.js';
import { getSettings } from '../settings.js';
import type { SupabaseAnyClient } from '../types/supabase.js';

export async function unwrap<T>(supabaseResult: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await supabaseResult;
  if (error) throw new AppError((error as { message?: string }).message || 'Erro Supabase', 400, 'supabase');
  return data;
}


export function adminClient(): SupabaseAnyClient {
  const settings = getSettings();
  return createClient(settings.supabaseUrl, settings.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: settings.schema },
  });
}

export function anonClient(): SupabaseAnyClient {
  const settings = getSettings();
  return createClient(settings.supabaseUrl, settings.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: settings.schema },
  });
}

export function userClient(token: string): SupabaseAnyClient {
  const settings = getSettings();
  return createClient(settings.supabaseUrl, settings.supabaseAnonKey, {
    db: { schema: settings.schema },
    accessToken: async () => token,
  });
}
