import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, validateOrigin } from '@/src/server/auth/guard';
import { lineUpdateSchema } from '@/src/lib/validation/receiving-document.schema';
import {
  removeDocumentLine,
  updateDocumentLine,
} from '@/src/server/services/receiving-document.service';
import { errorResponse, jsonResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { documentId: string; lineId: string } }
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

    const parsed = lineUpdateSchema.parse(body);
    const line = await updateDocumentLine(
      user,
      params.documentId,
      params.lineId,
      parsed
    );

    return jsonResponse(line, 200);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { documentId: string; lineId: string } }
) {
  try {
    const user = await requireAuth(request);
    validateOrigin(request);

    await removeDocumentLine(user, params.documentId, params.lineId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
