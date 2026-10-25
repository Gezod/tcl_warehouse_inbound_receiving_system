import { NextRequest } from 'next/server';
import { requireAuth, validateOrigin } from '@/src/server/auth/guard';
import { userCreateSchema, userQuerySchema } from '@/src/lib/validation/user.schema';
import { listUsers, createUser } from '@/src/server/services/user.service';
import { errorResponse, jsonResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = userQuerySchema.parse(searchParams);

    const result = await listUsers(user, query);
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

    const parsed = userCreateSchema.parse(body);
    const requestId = request.headers.get('x-request-id') || undefined;
    const result = await createUser(user, parsed, requestId);

    return jsonResponse(result, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
