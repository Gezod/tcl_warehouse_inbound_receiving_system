import { NextRequest } from 'next/server';
import { requireAuth, validateOrigin } from '@/src/server/auth/guard';
import { deactivateProduct } from '@/src/server/services/product.service';
import { errorResponse, jsonResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const user = await requireAuth(request);
    validateOrigin(request);

    const product = await deactivateProduct(user, params.productId);
    return jsonResponse(product, 200);
  } catch (err) {
    return errorResponse(err);
  }
}
