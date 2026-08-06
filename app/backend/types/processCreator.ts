export interface ProcessExtractResult {
  supply_code: string | null;
  composition_code: string | null;
  company_id: number | null;
  building_id: string | null;
  supplier_id: number | null;
  process_value: string | number | null;
  issue_date: string | null;
  due_date: string | null;
  document_kind_id: number | null;
  payment_kind_id: number | null;
  document_number: string | null;
  document_content: string | null;
  installment_quantity: number;
  is_urgente: number;
}
