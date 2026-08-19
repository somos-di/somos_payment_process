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
  createGroup(name: string, description: string | null, restrictLaunch: boolean, level: number) {
    return unwrap(adminClient().from('groups')
      .insert({ name_grp: name, description_grp: description, restrict_launch_kinds_grp: restrictLaunch, level_grp: level })
      .select('id_grp,name_grp,description_grp,restrict_launch_kinds_grp,level_grp').single());
  }

  addMembership(user: string, group: number) {
    return unwrap(adminClient().from('users_group')
      .upsert({ user_usg: user, group_usg: group }, { onConflict: 'user_usg,group_usg', ignoreDuplicates: true }));
  }
  removeMembership(user: string, group: number) {
    return unwrap(adminClient().from('users_group').delete().eq('user_usg', user).eq('group_usg', group));
  }
}
