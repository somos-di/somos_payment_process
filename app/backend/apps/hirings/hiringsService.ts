import { unwrap, userClient } from '../../gateways/supabase.js';

export interface HiringCreateInput {
  department: number;
  name: string;
  contractType: string;
  age?: number | null;
  salary?: number | null;
  period?: string | null;
  resumeUrl?: string | null;
}

export class HiringsService {
  private readonly view = 'v_hirings';

  list(token: string) {
    return unwrap(userClient(token).from(this.view).select('*').order('id_hir', { ascending: false }));
  }

  getByUuid(token: string, uuid: string) {
    return unwrap(userClient(token).from(this.view).select('*').eq('uuid_hir', uuid).single());
  }

  history(token: string, uuid: string) {
    return unwrap(userClient(token).from('v_hiring_history').select('*').eq('hiring_hhs', uuid).order('created_at_hhs', { ascending: false }));
  }

  departments(token: string) {
    return unwrap(userClient(token).from('v_departments').select('*').order('name_dep'));
  }

  users(token: string) {
    return unwrap(userClient(token).rpc('hiring_list_users'));
  }

  create(token: string, input: HiringCreateInput) {
    return unwrap(userClient(token).rpc('hiring_create', {
      p_department: input.department, p_name: input.name, p_contract_type: input.contractType,
      p_age: input.age ?? null, p_salary: input.salary ?? null,
      p_period: input.period ?? null, p_resume_url: input.resumeUrl ?? null,
    }));
  }

  update(token: string, uuid: string, input: HiringCreateInput) {
    return unwrap(userClient(token).rpc('hiring_update', {
      p_uuid: uuid, p_name: input.name, p_contract_type: input.contractType,
      p_age: input.age ?? null, p_salary: input.salary ?? null,
      p_period: input.period ?? null, p_resume_url: input.resumeUrl ?? null,
    }));
  }

  approve(token: string, uuid: string) {
    return unwrap(userClient(token).rpc('hiring_approve', { p_uuid: uuid }));
  }

  finalize(token: string, uuid: string) {
    return unwrap(userClient(token).rpc('hiring_finalize', { p_uuid: uuid }));
  }

  reject(token: string, uuid: string, reason: string) {
    return unwrap(userClient(token).rpc('hiring_reject', { p_uuid: uuid, p_reason: reason }));
  }

  resubmit(token: string, uuid: string) {
    return unwrap(userClient(token).rpc('hiring_resubmit', { p_uuid: uuid }));
  }

  cancel(token: string, uuid: string, reason: string) {
    return unwrap(userClient(token).rpc('hiring_cancel', { p_uuid: uuid, p_reason: reason }));
  }

  deptSetManagers(token: string, department: number, users: string[]) {
    return unwrap(userClient(token).rpc('dept_set_managers', { p_department: department, p_users: users }));
  }
}
