import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { requireAuth, validateOrigin } from '@/src/server/auth/guard';
import {
  idempotencyKeyHeaderSchema,
  receiptBatchCreateSchema,
} from '@/src/lib/validation/receipt.schema';
import { recordReceipts } from '@/src/server/services/receipt.service';
import { errorResponse, jsonResponse } from '@/src/server/http/respond';
import { AppError } from '@/src/server/errors';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const user = await requireAuth(request);
    validateOrigin(request);

    // 1. Validate Idempotency-Key header
    const rawKey = request.headers.get('Idempotency-Key');
    if (!rawKey) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Idempotency-Key header is required.',
        'Idempotency-Key'
      );
    }

    const keyResult = idempotencyKeyHeaderSchema.safeParse(rawKey);
    if (!keyResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        keyResult.error.issues[0].message,
        'Idempotency-Key'
      );
    }
    const idempotencyKey = keyResult.data;

    // 2. Validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Malformed JSON in request body.'
      );
    }

    const parsed = receiptBatchCreateSchema.parse(body);
    const requestId =
      request.headers.get('x-request-id') || crypto.randomUUID();

    // 3. Execute in service
    const { statusCode, data } = await recordReceipts(
      user,
      params.documentId,
      idempotencyKey,
      parsed,
      requestId
    );

    return jsonResponse(data, statusCode);
  } catch (err) {
    return errorResponse(err);
  }
}
