import { z } from 'zod';

export const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });
export const UuidParamSchema = z.object({ uuid: z.string().uuid() });
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const MAX_TEXT_FIELD = 5000;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_UPLOAD_BASE64 = Math.ceil(MAX_FILE_BYTES / 3) * 4 + 1024;

export const boundedRecord = z.record(z.any()).superRefine((record, context) => {
  for (const [fieldName, fieldValue] of Object.entries(record)) {
    if (typeof fieldValue === 'string' && fieldValue.length > MAX_TEXT_FIELD) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [fieldName], message: `Campo "${fieldName}" excede ${MAX_TEXT_FIELD} caracteres` });
    }
  }
});
