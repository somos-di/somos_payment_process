import { createClient } from '@supabase/supabase-js';
import { AppError, UnauthorizedError } from '../errors.js';
import { adminClient, anonClient, unwrap, userClient } from '../gateways/supabase.js';
import { getSettings } from '../settings.js';
import type { OAuthStart, PkceStorage, Session, UserProfile } from '../types/auth.js';

function memStorage(initial: Record<string, string> = {}): PkceStorage {
  const store: Record<string, string> = { ...initial };
  return {
    store,
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
  };
}

function oauthClient(storage: PkceStorage) {
  const settings = getSettings();
  return createClient(settings.supabaseUrl, settings.supabaseAnonKey, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storage },
    db: { schema: settings.schema },
  });
}

export class AuthService {
  async oauthStart(redirectTo: string): Promise<OAuthStart> {
    const storage = memStorage();
    const { data, error } = await oauthClient(storage).auth.signInWithOAuth({
      provider: 'azure',
      options: { redirectTo, skipBrowserRedirect: true, scopes: 'openid email profile' },
    });
    if (error || !data?.url) throw new AppError(error?.message || 'Falha ao iniciar OAuth', 400, 'oauth');
    return { url: data.url, pkce: JSON.stringify(storage.store) };
  }

  async oauthCallback(code: string, pkce: string): Promise<Session> {
    let initial: Record<string, string> = {};
    try { initial = JSON.parse(pkce || '{}'); } catch { }
    const { data, error } = await oauthClient(memStorage(initial)).auth.exchangeCodeForSession(code);
    if (error || !data?.session) throw new UnauthorizedError(error?.message || 'Falha no login Microsoft');
    const id = data.user!.id, email = data.user!.email || '';
    const userMetadata = (data.user!.user_metadata || {}) as Record<string, unknown>;
    const name = (userMetadata.full_name || userMetadata.name || null) as string | null;
    const userRow: Record<string, unknown> = { id_usr: id, email_usr: email };
    if (name) userRow.name_usr = name;
    await adminClient().from('users').upsert(userRow, { onConflict: 'id_usr' });
    return { token: data.session.access_token, refreshToken: data.session.refresh_token, user: { id, email: email } };
  }

  async refresh(refreshToken: string): Promise<Session> {
    const { data, error } = await anonClient().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) throw new UnauthorizedError('Sessão expirada');
    return {
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: { id: data.user.id, email: data.user.email || '' },
    };
  }

  private static readonly LOGIN_MAX = 10;
  private static readonly LOGIN_WINDOW_MS = 15 * 60 * 1000;
  private readonly failed = new Map<string, { count: number; until: number }>();

  async login(email: string, password: string): Promise<Session> {
    const key = (email || '').toLowerCase();
    const now = Date.now();
    const failure = this.failed.get(key);
    if (failure && failure.until > now && failure.count >= AuthService.LOGIN_MAX) {
      throw new AppError('Muitas tentativas para esta conta. Tente novamente em alguns minutos.', 429, 'rate_limited');
    }
    const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      const currentFailure = (failure && failure.until > now) ? failure : { count: 0, until: now + AuthService.LOGIN_WINDOW_MS };
      currentFailure.count++; this.failed.set(key, currentFailure);
      throw new UnauthorizedError(error?.message || 'Credenciais inválidas');
    }
    this.failed.delete(key);
    const id = data.user!.id, authenticatedEmail = data.user!.email || '';
    await adminClient().from('users').upsert({ id_usr: id, email_usr: authenticatedEmail }, { onConflict: 'id_usr', ignoreDuplicates: true });
    return { token: data.session.access_token, refreshToken: data.session.refresh_token, user: { id, email: authenticatedEmail } };
  }

  async me(token: string, id: string, email: string): Promise<UserProfile> {
    const client = userClient(token);
    const { data, error } = await client
      .from('users').select('name_usr, department_usr, is_admin, uau_user_usr').eq('id_usr', id).maybeSingle();
    if (error) throw new AppError(error.message, 400, 'supabase');
    let isFinanceiro = false, isCommission = false, isMedicao = false;
    try { isFinanceiro = !!(await unwrap(client.rpc('is_financeiro_member'))); } catch { }
    try { isCommission = !!(await unwrap(client.rpc('is_commission_member'))); } catch { }
    try { isMedicao = !!(await unwrap(client.rpc('is_medicao_member'))); } catch { }
    return {
      id, email, name: data?.name_usr ?? null, department: data?.department_usr ?? null,
      is_admin: !!data?.is_admin, is_financeiro: isFinanceiro, is_commission: isCommission, is_medicao: isMedicao,
      uau_user: data?.uau_user_usr ?? null,
    };
  }
}
