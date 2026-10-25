import { NextRequest } from 'next/server';
import { requireAuth, validateOrigin } from '@/src/server/auth/guard';
import { productUpdateSchema } from '@/src/lib/validation/product.schema';
import { getProduct, updateProduct } from '@/src/server/services/product.service';
import { errorResponse, jsonResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    await requireAuth(request);
    const product = await getProduct(params.productId);
    return jsonResponse(product, 200);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { productId: string } }
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

    const parsed = productUpdateSchema.parse(body);
    const product = await updateProduct(user, params.productId, parsed);

    return jsonResponse(product, 200);
  } catch (err) {
    return errorResponse(err);
  }
}
