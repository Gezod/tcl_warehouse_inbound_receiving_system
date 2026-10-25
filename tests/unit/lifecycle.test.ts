import { describe, it, expect } from 'vitest';
import { validateStatusTransition } from '@/src/server/domain/lifecycle';
import {
  receivingDocumentCreateSchema,
  receivingDocumentUpdateSchema,
  lineCreateSchema,
  lineUpdateSchema,
  receivingDocumentQuerySchema,
} from '@/src/lib/validation/receiving-document.schema';

describe('Receiving Document Lifecycle and Validation Unit Tests', () => {
  describe('validateStatusTransition (PRD Section 7)', () => {
    it('allows DRAFT -> OPEN when lineCount >= 1', () => {
      const result = validateStatusTransition('DRAFT', 'OPEN', {
        lineCount: 2,
        receiptCount: 0,
        allLinesReceived: false,
      });
      expect(result.allowed).toBe(true);
    });

    it('rejects DRAFT -> OPEN with NO_LINES when lineCount === 0', () => {
      const result = validateStatusTransition('DRAFT', 'OPEN', {
        lineCount: 0,
        receiptCount: 0,
        allLinesReceived: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('NO_LINES');
    });

    it('allows DRAFT -> CANCELLED when receiptCount === 0', () => {
      const result = validateStatusTransition('DRAFT', 'CANCELLED', {
        lineCount: 1,
        receiptCount: 0,
        allLinesReceived: false,
      });
      expect(result.allowed).toBe(true);
    });

    it('allows OPEN -> PARTIALLY_RECEIVED on receipt recording', () => {
      const result = validateStatusTransition('OPEN', 'PARTIALLY_RECEIVED', {
        lineCount: 1,
        receiptCount: 1,
        allLinesReceived: false,
      });
      expect(result.allowed).toBe(true);
    });

    it('allows OPEN -> CANCELLED when receiptCount === 0', () => {
      const result = validateStatusTransition('OPEN', 'CANCELLED', {
        lineCount: 2,
        receiptCount: 0,
        allLinesReceived: false,
      });
      expect(result.allowed).toBe(true);
    });

    it('rejects OPEN -> CANCELLED when receiptCount > 0 with DOCUMENT_HAS_RECEIPTS', () => {
      const result = validateStatusTransition('OPEN', 'CANCELLED', {
        lineCount: 2,
        receiptCount: 1,
        allLinesReceived: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('DOCUMENT_HAS_RECEIPTS');
    });

    it('rejects OPEN -> COMPLETED directly (PRD v1.1 Change log / D-02)', () => {
      const result = validateStatusTransition('OPEN', 'COMPLETED', {
        lineCount: 2,
        receiptCount: 0,
        allLinesReceived: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('INVALID_DOCUMENT_STATE');
    });

    it('allows PARTIALLY_RECEIVED -> COMPLETED when allLinesReceived is true', () => {
      const result = validateStatusTransition('PARTIALLY_RECEIVED', 'COMPLETED', {
        lineCount: 2,
        receiptCount: 2,
        allLinesReceived: true,
      });
      expect(result.allowed).toBe(true);
    });

    it('rejects PARTIALLY_RECEIVED -> COMPLETED when allLinesReceived is false with DOCUMENT_NOT_FULLY_RECEIVED', () => {
      const result = validateStatusTransition('PARTIALLY_RECEIVED', 'COMPLETED', {
        lineCount: 2,
        receiptCount: 1,
        allLinesReceived: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('DOCUMENT_NOT_FULLY_RECEIVED');
    });

    it('rejects PARTIALLY_RECEIVED -> CANCELLED with DOCUMENT_HAS_RECEIPTS', () => {
      const result = validateStatusTransition('PARTIALLY_RECEIVED', 'CANCELLED', {
        lineCount: 2,
        receiptCount: 1,
        allLinesReceived: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('DOCUMENT_HAS_RECEIPTS');
    });

    it('rejects any transition from terminal states COMPLETED and CANCELLED (BR-08)', () => {
      const fromCompleted = validateStatusTransition('COMPLETED', 'OPEN', {
        lineCount: 1,
        receiptCount: 1,
        allLinesReceived: true,
      });
      expect(fromCompleted.allowed).toBe(false);
      expect(fromCompleted.code).toBe('INVALID_DOCUMENT_STATE');

      const fromCancelled = validateStatusTransition('CANCELLED', 'DRAFT', {
        lineCount: 0,
        receiptCount: 0,
        allLinesReceived: false,
      });
      expect(fromCancelled.allowed).toBe(false);
      expect(fromCancelled.code).toBe('INVALID_DOCUMENT_STATE');
    });
  });

  describe('Receiving Document & Line Schema Validation', () => {
    it('receivingDocumentCreateSchema accepts valid header and trims fields', () => {
      const valid = {
        supplierName: '  Acme Logistics Inc.  ',
        referenceNumber: '  INV-2026-99  ',
        expectedArrivalDate: '2026-11-01',
        notes: ' Fragile cargo ',
      };
      const parsed = receivingDocumentCreateSchema.parse(valid);
      expect(parsed.supplierName).toBe('Acme Logistics Inc.');
      expect(parsed.referenceNumber).toBe('INV-2026-99');
      expect(parsed.expectedArrivalDate).toBe('2026-11-01');
      expect(parsed.notes).toBe('Fragile cargo');
    });

    it('receivingDocumentCreateSchema requires supplierName and rejects empty string', () => {
      expect(() =>
        receivingDocumentCreateSchema.parse({
          supplierName: '   ',
        })
      ).toThrow();
    });

    it('lineCreateSchema rejects expectedQty < 1 or non-integers', () => {
      expect(() =>
        lineCreateSchema.parse({
          productId: '00000000-0000-0000-0000-000000000001',
          expectedQty: 0,
        })
      ).toThrow();

      expect(() =>
        lineCreateSchema.parse({
          productId: '00000000-0000-0000-0000-000000000001',
          expectedQty: 2.5,
        })
      ).toThrow();
    });

    it('lineUpdateSchema requires expectedQty integer >= 1', () => {
      const parsed = lineUpdateSchema.parse({ expectedQty: 15 });
      expect(parsed.expectedQty).toBe(15);

      expect(() => lineUpdateSchema.parse({ expectedQty: -1 })).toThrow();
    });

    it('receivingDocumentQuerySchema applies default pagination', () => {
      const query = receivingDocumentQuerySchema.parse({});
      expect(query.page).toBe(1);
      expect(query.pageSize).toBe(20);
    });
  });
});
