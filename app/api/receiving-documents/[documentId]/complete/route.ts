import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { requireAuth, validateOrigin } from '@/src/server/auth/guard';
import { completeDocument } from '@/src/server/services/receiving-document.service';
import { errorResponse, jsonResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const user = await requireAuth(request);
    validateOrigin(request);

    const requestId =
      request.headers.get('x-request-id') || crypto.randomUUID();

    const doc = await completeDocument(user, params.documentId, requestId);
    return jsonResponse(doc, 200);
  } catch (err) {
    return errorResponse(err);
  }
}
