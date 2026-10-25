import { NextRequest } from 'next/server';
import { requireAuth, validateOrigin } from '@/src/server/auth/guard';
import { receivingDocumentUpdateSchema } from '@/src/lib/validation/receiving-document.schema';
import {
  getReceivingDocument,
  updateDocumentHeader,
} from '@/src/server/services/receiving-document.service';
import { errorResponse, jsonResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    await requireAuth(request);
    const doc = await getReceivingDocument(params.documentId);
    return jsonResponse(doc, 200);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const user = await requireAuth(request);
    validateOrigin(request);

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        {
          code: 'VALIDATION_ERROR',
          message: 'Malformed JSON in request body.',
        },
        400
      );
    }

    const parsed = receivingDocumentUpdateSchema.parse(body);
    const doc = await updateDocumentHeader(user, params.documentId, parsed);

    return jsonResponse(doc, 200);
  } catch (err) {
    return errorResponse(err);
  }
}
