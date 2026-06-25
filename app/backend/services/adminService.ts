import { AppError } from '../errors.js';
import { adminClient } from '../gateways/supabase.js';

// Administração (service_role): listar usuários e gerenciar vínculos usuário-grupo.
// users_group não tem policy de insert/delete, então a escrita é via service-role.
export class AdminService {
  private run<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
    return Promise.resolve(p).then(({ data, error }) => {
      if (error) throw new AppError((error as { message?: string }).message || 'Erro Supabase', 400, 'supabase');
      return data;
    });
  }

  listUsers() {
    return this.run(adminClient().from('users')
      .select('id_usr,email_usr,name_usr,department_usr,uau_user_usr').order('email_usr'));
  }
  setUauUser(user: string, uau: string | null) {
    return this.run(adminClient().from('users')
      .update({ uau_user_usr: uau && uau.trim() ? uau.trim() : null }).eq('id_usr', user));
  }
  addMembership(user: string, group: number) {
    return this.run(adminClient().from('users_group')
      .upsert({ user_usg: user, group_usg: group }, { onConflict: 'user_usg,group_usg', ignoreDuplicates: true }));
  }
  removeMembership(user: string, group: number) {
    return this.run(adminClient().from('users_group').delete().eq('user_usg', user).eq('group_usg', group));
  }
}
