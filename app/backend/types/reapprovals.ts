export interface ReapprovalPayload {
  approverId: string;
  companyId: number;
  costCenterId: string;
  processId: number;
  installmentId: number;
}

export interface ReapprovalResult {
  message: string;
}
