import { NextRequest } from 'next/server';
import { requireAuth } from '@/src/server/auth/guard';
import { transactionQuerySchema } from '@/src/lib/validation/transaction.schema';
import { listTransactions } from '@/src/server/services/transaction.service';
import { errorResponse, jsonResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );
    const query = transactionQuerySchema.parse(searchParams);

    const result = await listTransactions(user, query);
    return jsonResponse(result, 200);
  } catch (err) {
    return errorResponse(err);
  }
}
