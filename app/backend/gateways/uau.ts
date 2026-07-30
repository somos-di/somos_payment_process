import { AsyncHttpClient } from '../base/abstract.js';
import { RUNTIME } from '../config/runtime.js';
import type { HttpHeaders } from '../types/http.js';
import type { AppSettings } from '../types/settings.js';
import type { UauQueryRow } from '../types/uau.js';

export class UauGateway extends AsyncHttpClient {
  private readonly xIntegration: string;
  private readonly login: string;
  private readonly password: string;
  private token: string | null = null;
  private tokenExpiresAt = 0;
  private authenticating = false;

  constructor(settings: AppSettings) {
    super(settings.uau.baseUrl, settings.uau.timeoutMs);
    this.xIntegration = settings.uau.xIntegration;
    this.login = settings.uau.user;
    this.password = settings.uau.password;
  }

  protected override async getAuthToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    this.authenticating = true;
    try {
      const response = await this.client.post(
        '/api/v1.0/Autenticador/AutenticarUsuario',
        { login: this.login, senha: this.password },
        { headers: { 'X-INTEGRATION-Authorization': this.xIntegration } },
      );
      const token = typeof response.data === 'string' ? response.data : String(response.data);
      this.token = token;
      this.tokenExpiresAt = Date.now() + RUNTIME.uauGateway.tokenTtlMs;
      return token;
    } finally {
      this.authenticating = false;
    }
  }

  protected override async getAuthHeaders(): Promise<HttpHeaders> {
    if (this.authenticating) return { 'X-INTEGRATION-Authorization': this.xIntegration };
    const token = await this.getAuthToken();
    return { 'X-INTEGRATION-Authorization': this.xIntegration, Authorization: token };
  }

  async executeQuery(queryId: number): Promise<UauQueryRow[]> {
    const response = await this.client.post(
      '/api/v1.0/RotinasGerais/ExecutarConsultaGeral',
      { Id: queryId, Personalizado: 1, Parameters: [] },
    );
    if (!Array.isArray(response.data)) throw new Error('UAU executeQuery: resposta não é array');
    return response.data as UauQueryRow[];
  }
}
