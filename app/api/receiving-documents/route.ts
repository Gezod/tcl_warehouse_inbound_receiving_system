import { NextRequest } from 'next/server';
import { requireAuth, validateOrigin } from '@/src/server/auth/guard';
import {
  receivingDocumentCreateSchema,
  receivingDocumentQuerySchema,
} from '@/src/lib/validation/receiving-document.schema';
import {
  createDocument,
  listReceivingDocuments,
} from '@/src/server/services/receiving-document.service';
import { errorResponse, jsonResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = receivingDocumentQuerySchema.parse(searchParams);

    const result = await listReceivingDocuments(query);
    return jsonResponse(result, 200);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
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

    const parsed = receivingDocumentCreateSchema.parse(body);
    const doc = await createDocument(user, parsed);

    return jsonResponse(doc, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
