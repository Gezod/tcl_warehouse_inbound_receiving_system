import { NextRequest } from 'next/server';
import { requireAuth } from '@/src/server/auth/guard';
import { inventoryQuerySchema } from '@/src/lib/validation/inventory.schema';
import { listInventory } from '@/src/server/services/inventory.service';
import { errorResponse, jsonResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );
    const query = inventoryQuerySchema.parse(searchParams);

    const result = await listInventory(user, query);
    return jsonResponse(result, 200);
  } catch (err) {
    return errorResponse(err);
  }
}
