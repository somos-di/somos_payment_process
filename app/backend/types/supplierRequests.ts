export type OptText = string | null;

export interface SupplierFields {
  cnpj?: OptText;
  cpf?: OptText;
  nome?: OptText;
  razao_social?: OptText;
  cep?: OptText;
  city_id?: OptText;
  municipio?: OptText;
  uf?: OptText;
  logradouro?: OptText;
  numero?: OptText;
  bairro?: OptText;
  complemento?: OptText;
  telefone?: OptText;
  email?: OptText;
  inscricao_estadual?: OptText;
  atividade_principal?: OptText;
  atividades_secundarias?: OptText;
}

export interface SupplierRequestInput {
  kind: 'pj' | 'pf';
  document: string;
  name: string;
  fantasy?: OptText;
  fields: SupplierFields;
  company?: string;
  building?: string;
}

export interface SupplierRequestCreated { uuid_sup: string }
export interface SupplierTransitionResult { uuid_sup: string; status_step: number }
export interface SupplierTransitionOptions { note?: string; erpKey?: string }
export interface SupplierUauCheck { registered: boolean; person: unknown }
export interface SupplierSendResult { uuid_sup: string; erp_key: string | null; status_step: number }
