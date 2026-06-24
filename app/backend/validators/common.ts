import { z } from 'zod';

export const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });
export const UuidParamSchema = z.object({ uuid: z.string().uuid() });
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type IdParam = z.infer<typeof IdParamSchema>;
export type UuidParam = z.infer<typeof UuidParamSchema>;
