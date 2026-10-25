import { NextRequest } from 'next/server';
import { requireAuth, validateOrigin } from '@/src/server/auth/guard';
import {
  productCreateSchema,
  productQuerySchema,
} from '@/src/lib/validation/product.schema';
import { createProduct, listProducts } from '@/src/server/services/product.service';
import { errorResponse, jsonResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = productQuerySchema.parse(searchParams);

    const result = await listProducts(query);
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

    const parsed = productCreateSchema.parse(body);
    const product = await createProduct(user, parsed);

    return jsonResponse(product, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
