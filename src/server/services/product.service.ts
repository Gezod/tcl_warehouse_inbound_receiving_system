import { AppError } from '../errors';
import { requireRole } from '../auth/guard';
import { CurrentUser, Product, ProductPage, User } from '@/src/types/domain';
import {
  ProductCreateInput,
  ProductQueryInput,
  ProductUpdateInput,
} from '@/src/lib/validation/product.schema';
import {
  createProduct as repoCreateProduct,
  deactivateProduct as repoDeactivateProduct,
  findProductById,
  findProductBySku,
  findProducts,
  updateProduct as repoUpdateProduct,
} from '../repositories/product.repository';

export async function listProducts(options: ProductQueryInput): Promise<ProductPage> {
  const { products, total } = await findProducts({
    q: options.q,
    active: options.active,
    page: options.page,
    pageSize: options.pageSize,
  });

  return {
    data: products,
    pagination: {
      page: options.page,
      pageSize: options.pageSize,
      total,
    },
  };
}

export async function getProduct(id: string): Promise<Product> {
  const product = await findProductById(id);
  if (!product) {
    throw new AppError(404, 'NOT_FOUND', 'Product not found.');
  }
  return product;
}

export async function createProduct(
  user: User | CurrentUser,
  input: ProductCreateInput
): Promise<Product> {
  requireRole(user, ['SUPERVISOR']);

  const normalizedSku = input.sku.trim().toUpperCase();

  // BR-01: SKU unique case-insensitively
  const existing = await findProductBySku(normalizedSku);
  if (existing) {
    throw new AppError(
      409,
      'DUPLICATE_SKU',
      'A product with this SKU already exists.',
      'sku'
    );
  }

  return repoCreateProduct({
    sku: normalizedSku,
    name: input.name.trim(),
    baseUnit: input.baseUnit.trim(),
  });
}

export async function updateProduct(
  user: User | CurrentUser,
  id: string,
  input: ProductUpdateInput
): Promise<Product> {
  requireRole(user, ['SUPERVISOR']);

  const product = await findProductById(id);
  if (!product) {
    throw new AppError(404, 'NOT_FOUND', 'Product not found.');
  }

  const updates: { sku?: string; name?: string; baseUnit?: string } = {};

  if (input.sku !== undefined) {
    const normalizedNewSku = input.sku.trim().toUpperCase();
    if (normalizedNewSku !== product.sku) {
      // FR-03: SKU locked if product has receiving lines or inventory transactions
      if (product.hasTransactions) {
        throw new AppError(
          409,
          'SKU_LOCKED',
          'SKU cannot be changed because this product has existing receiving lines or inventory transactions.',
          'sku'
        );
      }

      // Check for SKU conflict with another product
      const conflict = await findProductBySku(normalizedNewSku);
      if (conflict && conflict.id !== product.id) {
        throw new AppError(
          409,
          'DUPLICATE_SKU',
          'A product with this SKU already exists.',
          'sku'
        );
      }

      updates.sku = normalizedNewSku;
    }
  }

  if (input.name !== undefined) {
    updates.name = input.name.trim();
  }

  if (input.baseUnit !== undefined) {
    updates.baseUnit = input.baseUnit.trim();
  }

  return repoUpdateProduct(id, updates);
}

export async function deactivateProduct(
  user: User | CurrentUser,
  id: string
): Promise<Product> {
  requireRole(user, ['SUPERVISOR']);

  const product = await findProductById(id);
  if (!product) {
    throw new AppError(404, 'NOT_FOUND', 'Product not found.');
  }

  // Idempotent: if already inactive, return 200 with current state
  if (!product.isActive) {
    return product;
  }

  return repoDeactivateProduct(id);
}
