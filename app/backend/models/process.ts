import { z } from 'zod';

// Schema = validação + tipo (convenção do referência). Tabela payment.processes.
export const ProcessInsertSchema = z.object({
  description_prc: z.string().optional(),
  company_prc: z.string().min(1),
  building_prc: z.string().min(1),
  composition_prc: z.string().optional(),
  supply_prc: z.string().optional(),
  person_prc: z.number().int().optional(),
  kind_prc: z.number().int(),
  department_prc: z.number().int().optional(),
  value_prc: z.number(),
  issue_date_prc: z.string().optional(),
  due_date_prc: z.string().optional(),
  is_urgent_prc: z.boolean().optional(),
  attachment_url_prc: z.string().optional(),
  attachment_url2_prc: z.string().optional(),
  fiscal_doc_prc: z.string().optional(),
});
export const ProcessUpdateSchema = ProcessInsertSchema.partial();

export type ProcessInsert = z.infer<typeof ProcessInsertSchema>;
export type ProcessUpdate = z.infer<typeof ProcessUpdateSchema>;
export interface ProcessRow extends ProcessInsert {
  id_prc: number; uuid_prc: string; status_step_prc: number;
  approving_status_prc: number; author_prc: string | null; active_prc: boolean;
}
