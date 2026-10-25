import { DocumentStatus } from '@/src/types/domain';

export interface TransitionContext {
  lineCount: number;
  receiptCount: number;
  allLinesReceived: boolean;
}

export interface TransitionResult {
  allowed: boolean;
  code?: 'INVALID_DOCUMENT_STATE' | 'NO_LINES' | 'DOCUMENT_HAS_RECEIPTS' | 'DOCUMENT_NOT_FULLY_RECEIVED';
  reason?: string;
}

/**
 * Enforces the PRD Section 7 lifecycle transition matrix.
 *
 * Valid transitions:
 * - (new) -> DRAFT
 * - DRAFT -> OPEN (requires lineCount >= 1)
 * - DRAFT -> CANCELLED (requires receiptCount === 0)
 * - OPEN -> PARTIALLY_RECEIVED (when receipt recorded)
 * - OPEN -> CANCELLED (requires receiptCount === 0)
 * - PARTIALLY_RECEIVED -> COMPLETED (requires allLinesReceived === true)
 *
 * Terminal states:
 * - COMPLETED (no outgoing transitions)
 * - CANCELLED (no outgoing transitions)
 */
export function validateStatusTransition(
  from: DocumentStatus,
  to: DocumentStatus,
  context: TransitionContext
): TransitionResult {
  if (from === 'COMPLETED' || from === 'CANCELLED') {
    return {
      allowed: false,
      code: 'INVALID_DOCUMENT_STATE',
      reason: `Document is in terminal state ${from} and cannot transition to ${to}.`,
    };
  }

  if (from === to) {
    return { allowed: true };
  }

  switch (from) {
    case 'DRAFT':
      if (to === 'OPEN') {
        if (context.lineCount < 1) {
          return {
            allowed: false,
            code: 'NO_LINES',
            reason: 'A receiving document must have at least one line before it can be submitted.',
          };
        }
        return { allowed: true };
      }
      if (to === 'CANCELLED') {
        if (context.receiptCount > 0) {
          return {
            allowed: false,
            code: 'DOCUMENT_HAS_RECEIPTS',
            reason: 'A document with recorded receipts cannot be cancelled.',
          };
        }
        return { allowed: true };
      }
      return {
        allowed: false,
        code: 'INVALID_DOCUMENT_STATE',
        reason: `Illegal status transition from DRAFT to ${to}.`,
      };

    case 'OPEN':
      if (to === 'PARTIALLY_RECEIVED') {
        return { allowed: true };
      }
      if (to === 'CANCELLED') {
        if (context.receiptCount > 0) {
          return {
            allowed: false,
            code: 'DOCUMENT_HAS_RECEIPTS',
            reason: 'A document with recorded receipts cannot be cancelled.',
          };
        }
        return { allowed: true };
      }
      return {
        allowed: false,
        code: 'INVALID_DOCUMENT_STATE',
        reason: `Illegal status transition from OPEN to ${to}. Direct transition to COMPLETED is forbidden; document must enter PARTIALLY_RECEIVED via receipt recording.`,
      };

    case 'PARTIALLY_RECEIVED':
      if (to === 'COMPLETED') {
        if (!context.allLinesReceived) {
          return {
            allowed: false,
            code: 'DOCUMENT_NOT_FULLY_RECEIVED',
            reason: 'All lines must have received quantity equal to expected quantity before completing.',
          };
        }
        return { allowed: true };
      }
      if (to === 'CANCELLED') {
        return {
          allowed: false,
          code: 'DOCUMENT_HAS_RECEIPTS',
          reason: 'A document with recorded receipts cannot be cancelled.',
        };
      }
      return {
        allowed: false,
        code: 'INVALID_DOCUMENT_STATE',
        reason: `Illegal status transition from PARTIALLY_RECEIVED to ${to}.`,
      };

    default:
      return {
        allowed: false,
        code: 'INVALID_DOCUMENT_STATE',
        reason: `Unknown state ${from}.`,
      };
  }
}
