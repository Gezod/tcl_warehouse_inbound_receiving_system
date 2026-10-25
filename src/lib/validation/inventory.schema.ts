import { z } from 'zod';

export const inventoryQuerySchema = z.object({
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type InventoryQueryInput = z.infer<typeof inventoryQuerySchema>;
