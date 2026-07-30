import { z } from 'zod';

export const uauTableSchema = z.object({
  id_uat: z.number().int(),
  uau_table_uat: z.string().max(100),
  uau_table_id_uat: z.number().int(),
  supabase_uau_table_uat: z.string().max(100),
});
