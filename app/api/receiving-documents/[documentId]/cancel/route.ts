import { NextRequest } from 'next/server';
import { requireAuth, validateOrigin } from '@/src/server/auth/guard';
import { cancelDocument } from '@/src/server/services/receiving-document.service';
import { errorResponse, jsonResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const user = await requireAuth(request);
    validateOrigin(request);

    const doc = await cancelDocument(user, params.documentId);
    return jsonResponse(doc, 200);
  } catch (err) {
    return errorResponse(err);
  }
}
