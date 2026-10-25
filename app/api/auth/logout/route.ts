import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, validateOrigin } from '@/src/server/auth/guard';
import { logout } from '@/src/server/services/auth.service';
import { getClearSessionCookieHeader } from '@/src/server/auth/token';
import { errorResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    validateOrigin(request);

    const token = getTokenFromRequest(request);
    await logout(token);

    const response = new NextResponse(null, { status: 204 });
    response.headers.set('Set-Cookie', getClearSessionCookieHeader());
    return response;
  } catch (err) {
    return errorResponse(err);
  }
}
