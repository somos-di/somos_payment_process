import { AppError, UnauthorizedError } from '../errors.js';
import { adminClient, anonClient, userClient } from '../gateways/supabase.js';

// Auth fica 100% no backend.  cookie httpcnly
export class AuthService {
  // login : retorna o access_token (vai virar cookie) + dados não-sensíveis do usuário.
  async login(email: string, password: string): Promise<{ token: string; user: { id: string; email: string } }> {
    const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new UnauthorizedError(error?.message || 'Credenciais inválidas');
    const id = data.user!.id, mail = data.user!.email || '';
    // auto-provisiona o perfil em payment.users (assim o usuário é atribuível a grupos
    // e serve de FK p/ author_prc). service_role pois users não tem policy de insert.
    await adminClient().from('users').upsert({ id_usr: id, email_usr: mail }, { onConflict: 'id_usr', ignoreDuplicates: true });
    return { token: data.session.access_token, user: { id, email: mail } };
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
  async me(token: string, id: string, email: string): Promise<{ id: string; email: string; name: string | null; department: number | null }> {
    const { data, error } = await userClient(token)
      .from('users').select('name_usr, department_usr').eq('id_usr', id).maybeSingle();
    if (error) throw new AppError(error.message, 400, 'supabase');
    return { id, email, name: data?.name_usr ?? null, department: data?.department_usr ?? null };
  }
}
