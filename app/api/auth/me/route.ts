import { NextRequest } from 'next/server';
import { getTokenFromRequest } from '@/src/server/auth/guard';
import { getCurrentUser } from '@/src/server/services/auth.service';
import { errorResponse, jsonResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    const user = await getCurrentUser(token);
    return jsonResponse(user, 200);
  } catch (err) {
    return errorResponse(err);
  }
}
