import { z } from 'zod';

// catálogo payment.uau_tables — queryId do UAU <-> tabela espelho no Supabase
export const uauTableSchema = z.object({
  id_uat: z.number().int(),
  uau_table_uat: z.string().max(100),
  uau_table_id_uat: z.number().int(),
  supabase_uau_table_uat: z.string().max(100),
});
export type UauTable = z.infer<typeof uauTableSchema>;
