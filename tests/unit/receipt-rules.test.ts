import { describe, it, expect } from 'vitest';
import {
  idempotencyKeyHeaderSchema,
  receiptBatchCreateSchema,
} from '@/src/lib/validation/receipt.schema';
import {
  canonicalJsonString,
  hashRequestBody,
} from '@/src/server/repositories/idempotency.repository';

describe('Receipts & Idempotency Unit Tests', () => {
  describe('Canonical JSON and Request Hashing', () => {
    it('produces deterministic output regardless of key order', () => {
      const obj1 = {
        receivedAt: '2026-10-25T10:00:00Z',
        items: [
          { lineId: '00000000-0000-0000-0000-000000000001', receivedQty: 5, note: 'Pallet 1' },
        ],
      };

      const obj2 = {
        items: [
          { note: 'Pallet 1', receivedQty: 5, lineId: '00000000-0000-0000-0000-000000000001' },
        ],
        receivedAt: '2026-10-25T10:00:00Z',
      };

      expect(canonicalJsonString(obj1)).toBe(canonicalJsonString(obj2));
      expect(hashRequestBody(obj1)).toBe(hashRequestBody(obj2));
    });

    it('produces different hashes for different payloads', () => {
      const obj1 = {
        receivedAt: '2026-10-25T10:00:00Z',
        items: [{ lineId: '00000000-0000-0000-0000-000000000001', receivedQty: 5 }],
      };
      const obj2 = {
        receivedAt: '2026-10-25T10:00:00Z',
        items: [{ lineId: '00000000-0000-0000-0000-000000000001', receivedQty: 6 }],
      };

      expect(hashRequestBody(obj1)).not.toBe(hashRequestBody(obj2));
    });
  });

  describe('Receipt Batch Schema Validation', () => {
    it('accepts valid receipt batch within allowed time window', () => {
      const valid = {
        receivedAt: new Date(Date.now() - 60000).toISOString(),
        items: [
          {
            lineId: '11111111-1111-1111-1111-111111111111',
            receivedQty: 10,
            note: 'Standard dock delivery',
          },
        ],
      };

      const parsed = receiptBatchCreateSchema.parse(valid);
      expect(parsed.items.length).toBe(1);
      expect(parsed.items[0].receivedQty).toBe(10);
    });

    it('rejects receivedAt date more than 5 minutes in the future', () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      expect(() =>
        receiptBatchCreateSchema.parse({
          receivedAt: futureDate,
          items: [
            {
              lineId: '11111111-1111-1111-1111-111111111111',
              receivedQty: 5,
            },
          ],
        })
      ).toThrowError(/receivedAt must not be in the future by more than 5 minutes/);
    });

    it('rejects duplicate lineId in items array (batch constraint)', () => {
      expect(() =>
        receiptBatchCreateSchema.parse({
          receivedAt: new Date().toISOString(),
          items: [
            {
              lineId: '11111111-1111-1111-1111-111111111111',
              receivedQty: 5,
            },
            {
              lineId: '11111111-1111-1111-1111-111111111111',
              receivedQty: 3,
            },
          ],
        })
      ).toThrowError(/Duplicate lineId found in receipt items/);
    });

    it('rejects empty items array', () => {
      expect(() =>
        receiptBatchCreateSchema.parse({
          receivedAt: new Date().toISOString(),
          items: [],
        })
      ).toThrow();
    });

    it('idempotencyKeyHeaderSchema validates length between 8 and 64 characters', () => {
      expect(idempotencyKeyHeaderSchema.parse('key-12345')).toBe('key-12345');
      expect(() => idempotencyKeyHeaderSchema.parse('short')).toThrow();
      expect(() => idempotencyKeyHeaderSchema.parse('a'.repeat(65))).toThrow();
    });
  });
});
