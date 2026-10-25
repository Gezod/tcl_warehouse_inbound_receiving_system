import { z } from 'zod';

export const productCreateSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU is required.')
    .max(32, 'SKU must not exceed 32 characters.')
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'SKU must start with alphanumeric character and contain only letters, numbers, dots, underscores, or hyphens.'),
  name: z
    .string()
    .min(1, 'Product name is required.')
    .max(150, 'Product name must not exceed 150 characters.')
    .trim(),
  baseUnit: z
    .string()
    .min(1, 'Base unit is required.')
    .max(20, 'Base unit must not exceed 20 characters.')
    .trim()
    .default('pcs'),
});

export const productUpdateSchema = z
  .object({
    sku: z
      .string()
      .min(1, 'SKU cannot be empty.')
      .max(32, 'SKU must not exceed 32 characters.')
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'SKU must start with alphanumeric character and contain only letters, numbers, dots, underscores, or hyphens.')
      .optional(),
    name: z
      .string()
      .min(1, 'Product name cannot be empty.')
      .max(150, 'Product name must not exceed 150 characters.')
      .trim()
      .optional(),
    baseUnit: z
      .string()
      .min(1, 'Base unit cannot be empty.')
      .max(20, 'Base unit must not exceed 20 characters.')
      .trim()
      .optional(),
  })
  .refine(
    (data) => data.sku !== undefined || data.name !== undefined || data.baseUnit !== undefined,
    {
      message: 'At least one field must be provided for update.',
    }
  );

export const productQuerySchema = z.object({
  q: z.string().max(100).optional(),
  active: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
