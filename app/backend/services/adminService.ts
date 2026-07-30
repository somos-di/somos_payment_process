import { adminClient, unwrap } from '../gateways/supabase.js';

export class AdminService {
  listUsers() {
    return unwrap(adminClient().from('users')
      .select('id_usr,email_usr,name_usr,department_usr,uau_user_usr').order('email_usr'));
  }
  setUauUser(user: string, uauUser: string | null) {
    return unwrap(adminClient().from('users')
      .update({ uau_user_usr: uauUser && uauUser.trim() ? uauUser.trim() : null }).eq('id_usr', user));
  }
  createGroup(name: string, description: string | null, restrictLaunch: boolean) {
    return unwrap(adminClient().from('groups')
      .insert({ name_grp: name, description_grp: description, restrict_launch_kinds_grp: restrictLaunch })
      .select('id_grp,name_grp,description_grp,restrict_launch_kinds_grp').single());
  }

  addMembership(user: string, group: number) {
    return unwrap(adminClient().from('users_group')
      .upsert({ user_usg: user, group_usg: group }, { onConflict: 'user_usg,group_usg', ignoreDuplicates: true }));
  }
  removeMembership(user: string, group: number) {
    return unwrap(adminClient().from('users_group').delete().eq('user_usg', user).eq('group_usg', group));
  }

  async addPermission(group: number, company: string, building: string, kind: number) {
    const client = adminClient();
    await unwrap(client.from('company_rules')
      .upsert({ group_crl: group, company_crl: company }, { onConflict: 'group_crl,company_crl', ignoreDuplicates: true }));
    await unwrap(client.from('building_permission')
      .upsert({ group_bup: group, company_bup: company, building_bup: building }, { onConflict: 'group_bup,company_bup,building_bup', ignoreDuplicates: true }));
    await unwrap(client.from('process_kind_rules')
      .upsert({ group_pkr: group, kind_pkr: kind, company_pkr: company, building_pkr: building }, { onConflict: 'group_pkr,kind_pkr,company_pkr,building_pkr', ignoreDuplicates: true }));
  }
  removePermission(group: number, company: string, building: string, kind: number) {
    return unwrap(adminClient().from('process_kind_rules').delete()
      .eq('group_pkr', group).eq('kind_pkr', kind).eq('company_pkr', company).eq('building_pkr', building));
  }
}
