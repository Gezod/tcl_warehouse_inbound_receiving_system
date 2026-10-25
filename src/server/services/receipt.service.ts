import { CurrentUser, ReceiptBatchResult, User } from '@/src/types/domain';
import { requireRole } from '../auth/guard';
import { ReceiptBatchCreateInput } from '@/src/lib/validation/receipt.schema';
import {
  hashRequestBody,
  insertInitialIdempotencyKey,
  updateFinalIdempotencyKey,
} from '../repositories/idempotency.repository';
import { executeReceiptBatch } from '../repositories/receipt.repository';
import { withTransaction } from '../db/tx';
import { AppError } from '../errors';

export interface RecordedReceiptResponse {
  statusCode: number;
  data: ReceiptBatchResult;
}

export async function recordReceipts(
  user: User | CurrentUser,
  documentId: string,
  idempotencyKey: string,
  input: ReceiptBatchCreateInput,
  requestId?: string
): Promise<RecordedReceiptResponse> {
  // 1. Role verification: Operator and Supervisor allowed (FR-10)
  requireRole(user, ['OPERATOR', 'SUPERVISOR']);

  // 2. Compute canonical SHA-256 hash of body (Tech Spec 9.3 step 3)
  const requestHash = hashRequestBody(input);

  return withTransaction(async (client) => {
    // 3. Idempotency check & concurrent locking (Tech Spec 9.3 step 5 & 6)
    const { inserted, record } = await insertInitialIdempotencyKey(
      user.id,
      idempotencyKey,
      requestHash,
      client
    );

    if (!inserted && record) {
      if (record.requestHash === requestHash) {
        // Cached replay: returns 200 with original result without creating duplicate transactions
        return {
          statusCode: 200,
          data: record.responseBody as ReceiptBatchResult,
        };
      } else {
        // Reused key with different payload
        throw new AppError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'This Idempotency-Key has already been used with a different request payload.'
        );
      }
    }

    // 4. Execute receipt batch atomically
    const result = await executeReceiptBatch(
      user.id,
      documentId,
      input.receivedAt,
      input.items,
      requestId,
      client
    );

    // 5. Finalize response for idempotency replay
    await updateFinalIdempotencyKey(
      user.id,
      idempotencyKey,
      201,
      result,
      client
    );

    return {
      statusCode: 201,
      data: result,
    };
  });
}
