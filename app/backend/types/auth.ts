export interface AccountFlags {
  reportViewer: boolean;
  mustChangePassword: boolean;
}

export interface AuthenticatedUser extends AccountFlags {
  id: string;
  email: string;
}

export interface Session {
  token: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

export interface SessionRefresher {
  refresh(refreshToken: string): Promise<Session>;
}

export interface PkceStorage {
  store: Record<string, string>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface OAuthStart {
  url: string;
  pkce: string;
}

export interface UserProfile extends Pick<AuthenticatedUser, 'id' | 'email'> {
  name: string | null;
  department: number | null;
  is_admin: boolean;
  is_financeiro: boolean;
  is_commission: boolean;
  is_medicao: boolean;
  is_supplier_requester: boolean;
  is_supplier_sender: boolean;
  is_hiring: boolean;
  uau_user: string | null;
  is_report_viewer: boolean;
  must_change_password: boolean;
}
