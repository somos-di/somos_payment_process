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

  // Permissão de visibilidade (regras de eliminação): empresa + obra + tipo p/ um grupo.
  // A visibilidade exige as 3; addPermission garante company_rules + building_permission + process_kind_rules.
  async addPermission(group: number, company: string, building: string, kind: number) {
    const a = adminClient();
    await this.run(a.from('company_rules')
      .upsert({ group_crl: group, company_crl: company }, { onConflict: 'group_crl,company_crl', ignoreDuplicates: true }));
    await this.run(a.from('building_permission')
      .upsert({ group_bup: group, company_bup: company, building_bup: building }, { onConflict: 'group_bup,company_bup,building_bup', ignoreDuplicates: true }));
    await this.run(a.from('process_kind_rules')
      .upsert({ group_pkr: group, kind_pkr: kind, company_pkr: company, building_pkr: building }, { onConflict: 'group_pkr,kind_pkr,company_pkr,building_pkr', ignoreDuplicates: true }));
  }
  // Remove a permissão de UM tipo na obra (mantém company/building — sozinhos não dão visibilidade).
  removePermission(group: number, company: string, building: string, kind: number) {
    return this.run(adminClient().from('process_kind_rules').delete()
      .eq('group_pkr', group).eq('kind_pkr', kind).eq('company_pkr', company).eq('building_pkr', building));
  }
}
