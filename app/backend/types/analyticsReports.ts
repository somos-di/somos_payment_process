export interface AnalyticsReport {
  id: number;
  created_at: string;
  empreendimento: string;
  relatorio: string;
  titulo: string;
  revisao: number;
  empresas: string[];
}

export interface AnalyticsReportFile {
  url: string;
  expires_in: number;
}
