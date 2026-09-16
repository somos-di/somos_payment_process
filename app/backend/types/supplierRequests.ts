export interface SupplierFields {
  cnpj?: string;
  cpf?: string;
  nome?: string;
  razao_social?: string;
  cep?: string;
  city_id?: string;
  municipio?: string;
  uf?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  telefone?: string;
  email?: string;
  inscricao_estadual?: string;
  atividade_principal?: string;
  atividades_secundarias?: string;
}

export interface SupplierRequestInput {
  kind: 'pj' | 'pf';
  document: string;
  name: string;
  fantasy?: string;
  fields: SupplierFields;
  company?: string;
  building?: string;
}

export interface SupplierRequestCreated { uuid_sup: string }
export interface SupplierTransitionResult { uuid_sup: string; status_step: number }
export interface SupplierTransitionOptions { note?: string; erpKey?: string }
export interface SupplierUauCheck { registered: boolean; person: unknown }
export interface SupplierSendResult { uuid_sup: string; erp_key: string | null; status_step: number }
