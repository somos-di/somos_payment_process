import type { z } from 'zod';
import type { IdParamSchema, PaginationQuerySchema, UuidParamSchema } from '../validators/common.js';

export type IdParam = z.infer<typeof IdParamSchema>;
export type UuidParam = z.infer<typeof UuidParamSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
