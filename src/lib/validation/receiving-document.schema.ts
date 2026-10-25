import { z } from 'zod';

export const receivingDocumentCreateSchema = z.object({
  supplierName: z
    .string()
    .trim()
    .min(1, 'Supplier name is required.')
    .max(150, 'Supplier name must not exceed 150 characters.'),
  referenceNumber: z
    .string()
    .max(60, 'Reference number must not exceed 60 characters.')
    .trim()
    .nullable()
    .optional()
    .transform((val) => (val === '' ? null : val)),
  expectedArrivalDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected arrival date must be in YYYY-MM-DD format.')
    .nullable()
    .optional()
    .transform((val) => (val === '' ? null : val)),
  notes: z
    .string()
    .max(1000, 'Notes must not exceed 1000 characters.')
    .trim()
    .nullable()
    .optional()
    .transform((val) => (val === '' ? null : val)),
});

export const receivingDocumentUpdateSchema = z
  .object({
    supplierName: z
      .string()
      .trim()
      .min(1, 'Supplier name cannot be empty.')
      .max(150, 'Supplier name must not exceed 150 characters.')
      .optional(),
    referenceNumber: z
      .string()
      .max(60, 'Reference number must not exceed 60 characters.')
      .trim()
      .nullable()
      .optional()
      .transform((val) => (val === '' ? null : val)),
    expectedArrivalDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected arrival date must be in YYYY-MM-DD format.')
      .nullable()
      .optional()
      .transform((val) => (val === '' ? null : val)),
    notes: z
      .string()
      .max(1000, 'Notes must not exceed 1000 characters.')
      .trim()
      .nullable()
      .optional()
      .transform((val) => (val === '' ? null : val)),
  })
  .refine(
    (data) =>
      data.supplierName !== undefined ||
      data.referenceNumber !== undefined ||
      data.expectedArrivalDate !== undefined ||
      data.notes !== undefined,
    {
      message: 'At least one field must be provided for update.',
    }
  );

export const lineCreateSchema = z.object({
  productId: z.string().uuid('Product ID must be a valid UUID.'),
  expectedQty: z
    .number({ invalid_type_error: 'expectedQty must be an integer.' })
    .int('expectedQty must be an integer.')
    .min(1, 'expectedQty must be an integer of at least 1.')
    .max(1000000, 'expectedQty must not exceed 1,000,000.'),
});

export const lineUpdateSchema = z.object({
  expectedQty: z
    .number({ invalid_type_error: 'expectedQty must be an integer.' })
    .int('expectedQty must be an integer.')
    .min(1, 'expectedQty must be an integer of at least 1.')
    .max(1000000, 'expectedQty must not exceed 1,000,000.'),
});

export const receivingDocumentQuerySchema = z.object({
  status: z
    .enum(['DRAFT', 'OPEN', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED'])
    .optional(),
  supplier: z.string().max(150).optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateFrom must be in YYYY-MM-DD format.')
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateTo must be in YYYY-MM-DD format.')
    .optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ReceivingDocumentCreateInput = z.infer<typeof receivingDocumentCreateSchema>;
export type ReceivingDocumentUpdateInput = z.infer<typeof receivingDocumentUpdateSchema>;
export type LineCreateInput = z.infer<typeof lineCreateSchema>;
export type LineUpdateInput = z.infer<typeof lineUpdateSchema>;
export type ReceivingDocumentQueryInput = z.infer<typeof receivingDocumentQuerySchema>;
