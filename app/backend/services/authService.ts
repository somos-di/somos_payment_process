import { createClient } from '@supabase/supabase-js';
import { AppError, UnauthorizedError } from '../errors.js';
import { adminClient, anonClient, unwrap, userClient } from '../gateways/supabase.js';
import { getSettings } from '../settings.js';

// Sessão emitida pelo Supabase: access token (JWT curto), refresh token (renova a
// sessão) e o usuário. Compartilhada por login, oauthCallback e refresh.
export interface Session {
  token: string;
  refreshToken: string;
  user: { id: string; email: string };
}

// storage em memória pro handshake PKCE: o verifier que o supabase-js gera no
// `signInWithOAuth` é capturado daqui e persistido num cookie curto entre
// start→callback (backend é stateless). No callback, restauramos o verifier.
function memStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    store,
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };
}

function oauthClient(storage: ReturnType<typeof memStorage>) {
  const s = getSettings();
  return createClient(s.supabaseUrl, s.supabaseAnonKey, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storage },
    db: { schema: s.schema },
  });
}

// Auth fica 100% no backend.  cookie httpcnly
export class AuthService {
  // OAuth (Microsoft/Azure via Supabase). Inicia o fluxo PKCE e devolve a URL de
  // autorização + o estado PKCE serializado (vai num cookie curto).
  async oauthStart(redirectTo: string): Promise<{ url: string; pkce: string }> {
    const storage = memStorage();
    const { data, error } = await oauthClient(storage).auth.signInWithOAuth({
      provider: 'azure',
      options: { redirectTo, skipBrowserRedirect: true, scopes: 'openid email profile' },
    });
    if (error || !data?.url) throw new AppError(error?.message || 'Falha ao iniciar OAuth', 400, 'oauth');
    return { url: data.url, pkce: JSON.stringify(storage.store) };
  }

  // Troca o `code` pela sessão (usando o verifier restaurado), provisiona o perfil
  // e devolve access + refresh token (viram cookies httpOnly, igual ao login e-mail/senha).
  async oauthCallback(code: string, pkce: string): Promise<Session> {
    let initial: Record<string, string> = {};
    try { initial = JSON.parse(pkce || '{}'); } catch { /* cookie ausente/corrompido */ }
    const { data, error } = await oauthClient(memStorage(initial)).auth.exchangeCodeForSession(code);
    if (error || !data?.session) throw new UnauthorizedError(error?.message || 'Falha no login Microsoft');
    const id = data.user!.id, mail = data.user!.email || '';
    // nome vindo do perfil Microsoft (Azure mapeia p/ user_metadata.full_name/name)
    const meta = (data.user!.user_metadata || {}) as Record<string, unknown>;
    const name = (meta.full_name || meta.name || null) as string | null;
    const row: Record<string, unknown> = { id_usr: id, email_usr: mail };
    if (name) row.name_usr = name; // só seta se veio (não zera nome existente)
    // sem ignoreDuplicates: atualiza o nome no row já existente do usuário
    await adminClient().from('users').upsert(row, { onConflict: 'id_usr' });
    return { token: data.session.access_token, refreshToken: data.session.refresh_token, user: { id, email: mail } };
  }

  // RENOVAÇÃO da sessão: troca o refresh token por um novo par (access+refresh),
  // mantendo o usuário logado sem novo login. O Supabase rotaciona o refresh token,
  // por isso devolvemos o novo (o requireAuth regrava os cookies). Chamado quando o
  // access token (JWT) expira — é o que mantém a sessão "aberta".
  async refresh(refreshToken: string): Promise<Session> {
    const { data, error } = await anonClient().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) throw new UnauthorizedError('Sessão expirada');
    return {
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: { id: data.user.id, email: data.user.email || '' },
    };
  }

  // brute-force por E-MAIL (independe de IP/XFF): N falhas por conta numa janela -> 429.
  // Complementa o rate-limit por IP do /auth/login. In-memory (1 instância).
  private static readonly LOGIN_MAX = 10;
  private static readonly LOGIN_WINDOW_MS = 15 * 60 * 1000;
  private readonly failed = new Map<string, { n: number; until: number }>();

  // login : retorna access + refresh token (viram cookies) + dados não-sensíveis do usuário.
  async login(email: string, password: string): Promise<Session> {
    const key = (email || '').toLowerCase();
    const now = Date.now();
    const f = this.failed.get(key);
    if (f && f.until > now && f.n >= AuthService.LOGIN_MAX) {
      throw new AppError('Muitas tentativas para esta conta. Tente novamente em alguns minutos.', 429, 'rate_limited');
    }
    const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      const cur = (f && f.until > now) ? f : { n: 0, until: now + AuthService.LOGIN_WINDOW_MS };
      cur.n++; this.failed.set(key, cur);
      throw new UnauthorizedError(error?.message || 'Credenciais inválidas');
    }
    this.failed.delete(key); // sucesso zera o contador
    const id = data.user!.id, mail = data.user!.email || '';
    // auto-provisiona o perfil em payment.users (assim o usuário é atribuível a grupos
    // e serve de FK p/ author_prc). service_role pois users não tem policy de insert.
    await adminClient().from('users').upsert({ id_usr: id, email_usr: mail }, { onConflict: 'id_usr', ignoreDuplicates: true });
    return { token: data.session.access_token, refreshToken: data.session.refresh_token, user: { id, email: mail } };
  }

  // DIAGNÓSTICO: o que o Postgres enxerga como auth.uid() via userClient(token).
  // async whoami(token: string): Promise<{ jwtSub: string; dbUid: unknown }> {
  //   let jwtSub = '?';
  //   try { jwtSub = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sub; } catch { /* ignore */ }
  //   const { data, error } = await userClient(token).rpc('whoami');
  //   if (error) throw new AppError(error.message, 400, 'supabase');
  //   return { jwtSub, dbUid: data };
  // }
  // esse whoami eu usei para diagnóstico, mas não é neces´sario expor
  // perfil do usuário logado (inclui o departamento) — lido com o JWT (RLS vale).
  async me(token: string, id: string, email: string): Promise<{ id: string; email: string; name: string | null; department: number | null; is_admin: boolean; is_financeiro: boolean }> {
    const client = userClient(token);
    const { data, error } = await client
      .from('users').select('name_usr, department_usr, is_admin').eq('id_usr', id).maybeSingle();
    if (error) throw new AppError(error.message, 400, 'supabase');
    // is_financeiro: membro de algum grupo "Financeiro Integração%" (gate das telas de
    // financeiro). Derivado de group membership via RPC (auth.uid()), não de coluna.
    let isFinanceiro = false;
    try { isFinanceiro = !!(await unwrap(client.rpc('is_financeiro_member'))); } catch { /* sem acesso => false */ }
    return {
      id, email, name: data?.name_usr ?? null, department: data?.department_usr ?? null,
      is_admin: !!data?.is_admin, is_financeiro: isFinanceiro,
    };
  }
}
