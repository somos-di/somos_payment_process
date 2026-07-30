export interface AuthenticatedUser {
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

export interface UserProfile extends AuthenticatedUser {
  name: string | null;
  department: number | null;
  is_admin: boolean;
  is_financeiro: boolean;
  is_commission: boolean;
}
