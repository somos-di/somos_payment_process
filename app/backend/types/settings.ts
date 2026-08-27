export interface UauSettings {
  baseUrl: string;
  user: string;
  password: string;
  xIntegration: string;
  timeoutMs: number;
}

export interface IntegrationSettings {
  webhookEndpoint: string;
}

export interface ReapprovalSettings {
  workflowEndPoint: string;
}

export interface ProcessCreatorSettings {
  baseUrl: string;
  token: string;
  timeoutMs: number;
}

export interface MeasurementSettings {
  baseUrl: string;
  token: string;
  timeoutMs: number;
}

export interface AppSettings {
  port: number;
  host: string;
  corsOrigin: string;
  trustProxy: boolean | number | string;
  publicUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  schema: string;
  cookieName: string;
  cookieSecure: boolean;
  attachmentsBucket: string;
  redisUrl: string | null;
  cacheTtlMs: number;
  uau: UauSettings;
  n8nBaseUrl: string;
  integration: IntegrationSettings;
  reapproval: ReapprovalSettings;
  processCreator: ProcessCreatorSettings;
  measurement: MeasurementSettings;
}
