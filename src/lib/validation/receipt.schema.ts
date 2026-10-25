import { z } from 'zod';

export const receiptItemSchema = z.object({
  lineId: z.string().uuid('lineId must be a valid UUID.'),
  receivedQty: z
    .number({ invalid_type_error: 'receivedQty must be an integer.' })
    .int('receivedQty must be an integer.')
    .min(1, 'receivedQty must be an integer of at least 1.')
    .max(1000000, 'receivedQty must not exceed 1,000,000.'),
  note: z
    .string()
    .max(255, 'Note must not exceed 255 characters.')
    .trim()
    .nullable()
    .optional()
    .transform((val) => (val === '' ? null : val)),
});

export const receiptBatchCreateSchema = z
  .object({
    receivedAt: z
      .string()
      .datetime({ message: 'receivedAt must be an ISO 8601 timestamp in UTC.' })
      .refine(
        (val) => {
          const date = new Date(val);
          // Must not be in the future by more than 5 minutes
          const maxFuture = Date.now() + 5 * 60 * 1000;
          return date.getTime() <= maxFuture;
        },
        {
          message: 'receivedAt must not be in the future by more than 5 minutes.',
        }
      ),
    items: z
      .array(receiptItemSchema)
      .min(1, 'At least one receipt item is required in the batch.')
      .max(100, 'A batch cannot contain more than 100 receipt items.'),
  })
  .refine(
    (data) => {
      const lineIds = new Set<string>();
      for (const item of data.items) {
        if (lineIds.has(item.lineId)) {
          return false;
        }
        lineIds.add(item.lineId);
      }
      return true;
    },
    {
      message: 'Duplicate lineId found in receipt items.',
      path: ['items'],
    }
  );

export const idempotencyKeyHeaderSchema = z
  .string()
  .min(8, 'Idempotency-Key must be at least 8 characters.')
  .max(64, 'Idempotency-Key must not exceed 64 characters.');

export type ReceiptItemInput = z.infer<typeof receiptItemSchema>;
export type ReceiptBatchCreateInput = z.infer<typeof receiptBatchCreateSchema>;
