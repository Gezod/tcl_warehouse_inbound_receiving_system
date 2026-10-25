import { NextRequest } from 'next/server';
import { loginSchema } from '@/src/lib/validation/auth.schema';
import { login } from '@/src/server/services/auth.service';
import { getSessionCookieHeader } from '@/src/server/auth/token';
import { errorResponse, jsonResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
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

    const parsed = loginSchema.parse(body);
    const { user, token } = await login(parsed);

    const cookieHeader = getSessionCookieHeader(token);

    return jsonResponse(user, 200, {
      'Set-Cookie': cookieHeader,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
