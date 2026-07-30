export type ProcessFields = Record<string, unknown>;

export interface InstallmentInput {
  due_date_ins: string;
  value_ins: number;
}

export interface InstallmentRow extends InstallmentInput {
  number_ins: number;
}

export interface ProcessValueRow {
  value_prc: number | null;
}

export interface SolicitationInput {
  process: ProcessFields;
  installments: InstallmentInput[];
}

export interface ProcessCreated {
  uuid_prc: string;
}

export interface InstallmentsReplaced {
  uuid_prc: string;
  count: number;
}

export interface ProcessCorrected {
  uuid_prc: string;
  resent: boolean;
}

export interface BulkCreateResult {
  ok: boolean;
  uuid_prc?: string;
  error?: string;
}

export interface BatchApprovalResult {
  uuid: string;
  ok: boolean;
  error?: string;
}
