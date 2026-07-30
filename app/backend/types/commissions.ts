export interface CommissionTransitionOptions {
  note?: string;
  nfUrl?: string;
  boletoUrl?: string;
  sellerEmail?: string;
  sellerPhone?: string;
}

export interface CommissionInput {
  company: string;
  building: string;
  value: number;
  sellerName: string;
  clientName: string;
  unit?: string;
  saleNum?: string;
  saleDate?: string;
  releaseDate?: string;
  sellerId?: number;
  sellerEmail?: string;
  sellerPhone?: string;
  note?: string;
}

export interface EmpreendimentoInput {
  id?: number | null;
  name: string;
  company: string;
  building: string;
  somos: boolean;
  active?: boolean;
}

export interface CommissionTransitionResult {
  uuid_com: string;
  status_step: number;
}

export interface CommissionCreated {
  uuid_com: string;
}

export interface EmpreendimentoUpserted {
  id_cem: number;
}
