import { z } from 'zod';

export const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });
export const UuidParamSchema = z.object({ uuid: z.string().uuid() });
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type IdParam = z.infer<typeof IdParamSchema>;
export type UuidParam = z.infer<typeof UuidParamSchema>;

// ── Limites anti-abuso (evitam texto gigante / upload gigante estourando o banco).
// Teto de SEGURANÇA por campo de texto livre: o front ainda aplica limites por campo
// (menores); este é a rede que impede um POST manual com megabytes de texto.
export const MAX_TEXT_FIELD = 5000;
// Arquivo: 14 MiB. Cabe com folga no bodyLimit de 20MB após o base64 (~+34%).
export const MAX_FILE_BYTES = 14 * 1024 * 1024;
// Teto grosseiro do base64 correspondente (rejeita cedo, antes de decodificar).
export const MAX_UPLOAD_B64 = Math.ceil(MAX_FILE_BYTES / 3) * 4 + 1024;

// Processos mandam um objeto livre (z.record). Rede de segurança: nenhuma string do
// objeto pode passar de MAX_TEXT_FIELD. Não enumera campos (o schema é dinâmico).
export const boundedRecord = z.record(z.any()).superRefine((obj, ctx) => {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && v.length > MAX_TEXT_FIELD) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [k], message: `Campo "${k}" excede ${MAX_TEXT_FIELD} caracteres` });
    }
  }
});
