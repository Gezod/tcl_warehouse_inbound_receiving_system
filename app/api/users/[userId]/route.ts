import { NextRequest } from 'next/server';
import { requireAuth, validateOrigin } from '@/src/server/auth/guard';
import { userUpdateSchema } from '@/src/lib/validation/user.schema';
import { updateUser } from '@/src/server/services/user.service';
import { errorResponse, jsonResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
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

    const parsed = userUpdateSchema.parse(body);
    const requestId = request.headers.get('x-request-id') || undefined;
    const result = await updateUser(user, params.userId, parsed, requestId);

    return jsonResponse(result, 200);
  } catch (err) {
    return errorResponse(err);
  }
}
