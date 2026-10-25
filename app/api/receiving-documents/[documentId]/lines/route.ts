import { NextRequest } from 'next/server';
import { requireAuth, validateOrigin } from '@/src/server/auth/guard';
import { lineCreateSchema } from '@/src/lib/validation/receiving-document.schema';
import { addDocumentLine } from '@/src/server/services/receiving-document.service';
import { errorResponse, jsonResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function POST(
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

    const parsed = lineCreateSchema.parse(body);
    const line = await addDocumentLine(user, params.documentId, parsed);

    return jsonResponse(line, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
