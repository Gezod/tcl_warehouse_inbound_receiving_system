import { z } from 'zod';

export const transactionQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateFrom must be in YYYY-MM-DD format.')
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateTo must be in YYYY-MM-DD format.')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type TransactionQueryInput = z.infer<typeof transactionQuerySchema>;
