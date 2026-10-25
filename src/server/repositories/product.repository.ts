import { PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { Product } from '@/src/types/domain';

export async function findProducts(
  options: {
    q?: string;
    active?: boolean;
    page: number;
    pageSize: number;
  },
  client?: PoolClient
): Promise<{ products: Product[]; total: number }> {
  const db = client || getPool();
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (options.q && options.q.trim()) {
    conditions.push(`(p.sku ILIKE $${paramIndex} OR p.name ILIKE $${paramIndex})`);
    params.push(`%${options.q.trim()}%`);
    paramIndex++;
  }

  if (options.active !== undefined) {
    conditions.push(`p.is_active = $${paramIndex}`);
    params.push(options.active);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total query
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM products p
    ${whereClause};
  `;
  const countResult = await db.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  // Data query
  const offset = (options.page - 1) * options.pageSize;
  params.push(options.pageSize);
  const limitParamIndex = paramIndex++;
  params.push(offset);
  const offsetParamIndex = paramIndex++;

  const dataQuery = `
    SELECT 
      p.id,
      p.sku,
      p.name,
      p.base_unit,
      p.is_active,
      p.created_at,
      p.updated_at,
      (
        EXISTS (SELECT 1 FROM receiving_lines WHERE product_id = p.id) OR
        EXISTS (SELECT 1 FROM inventory_transactions WHERE product_id = p.id)
      ) AS has_transactions
    FROM products p
    ${whereClause}
    ORDER BY p.sku ASC
    LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex};
  `;

  const result = await db.query(dataQuery, params);

  const products: Product[] = result.rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    name: row.name,
    baseUnit: row.base_unit,
    isActive: row.is_active,
    hasTransactions: row.has_transactions,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));

  return { products, total };
}

export async function findProductById(
  id: string,
  client?: PoolClient
): Promise<Product | null> {
  const db = client || getPool();
  const query = `
    SELECT 
      p.id,
      p.sku,
      p.name,
      p.base_unit,
      p.is_active,
      p.created_at,
      p.updated_at,
      (
        EXISTS (SELECT 1 FROM receiving_lines WHERE product_id = p.id) OR
        EXISTS (SELECT 1 FROM inventory_transactions WHERE product_id = p.id)
      ) AS has_transactions
    FROM products p
    WHERE p.id = $1
    LIMIT 1;
  `;

  const result = await db.query(query, [id]);
  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    baseUnit: row.base_unit,
    isActive: row.is_active,
    hasTransactions: row.has_transactions,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findProductBySku(
  sku: string,
  client?: PoolClient
): Promise<Product | null> {
  const db = client || getPool();
  const normalizedSku = sku.trim().toUpperCase();

  const query = `
    SELECT 
      p.id,
      p.sku,
      p.name,
      p.base_unit,
      p.is_active,
      p.created_at,
      p.updated_at,
      (
        EXISTS (SELECT 1 FROM receiving_lines WHERE product_id = p.id) OR
        EXISTS (SELECT 1 FROM inventory_transactions WHERE product_id = p.id)
      ) AS has_transactions
    FROM products p
    WHERE upper(p.sku) = $1
    LIMIT 1;
  `;

  const result = await db.query(query, [normalizedSku]);
  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    baseUnit: row.base_unit,
    isActive: row.is_active,
    hasTransactions: row.has_transactions,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function checkProductHasTransactions(
  id: string,
  client?: PoolClient
): Promise<boolean> {
  const db = client || getPool();
  const query = `
    SELECT (
      EXISTS (SELECT 1 FROM receiving_lines WHERE product_id = $1) OR
      EXISTS (SELECT 1 FROM inventory_transactions WHERE product_id = $1)
    ) AS has_transactions;
  `;
  const result = await db.query(query, [id]);
  return result.rows[0]?.has_transactions || false;
}

export async function createProduct(
  product: { sku: string; name: string; baseUnit: string },
  client?: PoolClient
): Promise<Product> {
  const db = client || getPool();
  const normalizedSku = product.sku.trim().toUpperCase();

  const query = `
    INSERT INTO products (sku, name, base_unit, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, true, now(), now())
    RETURNING id, sku, name, base_unit, is_active, created_at, updated_at;
  `;

  const result = await db.query(query, [
    normalizedSku,
    product.name.trim(),
    product.baseUnit.trim(),
  ]);

  const row = result.rows[0];
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    baseUnit: row.base_unit,
    isActive: row.is_active,
    hasTransactions: false,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function updateProduct(
  id: string,
  fields: { sku?: string; name?: string; baseUnit?: string },
  client?: PoolClient
): Promise<Product> {
  const db = client || getPool();
  const setClauses: string[] = ['updated_at = now()'];
  const params: any[] = [id];
  let paramIndex = 2;

  if (fields.sku !== undefined) {
    setClauses.push(`sku = $${paramIndex}`);
    params.push(fields.sku.trim().toUpperCase());
    paramIndex++;
  }

  if (fields.name !== undefined) {
    setClauses.push(`name = $${paramIndex}`);
    params.push(fields.name.trim());
    paramIndex++;
  }

  if (fields.baseUnit !== undefined) {
    setClauses.push(`base_unit = $${paramIndex}`);
    params.push(fields.baseUnit.trim());
    paramIndex++;
  }

  const query = `
    UPDATE products
    SET ${setClauses.join(', ')}
    WHERE id = $1
    RETURNING id, sku, name, base_unit, is_active, created_at, updated_at;
  `;

  const result = await db.query(query, params);
  const row = result.rows[0];

  const hasTx = await checkProductHasTransactions(id, client);

  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    baseUnit: row.base_unit,
    isActive: row.is_active,
    hasTransactions: hasTx,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function deactivateProduct(
  id: string,
  client?: PoolClient
): Promise<Product> {
  const db = client || getPool();
  const query = `
    UPDATE products
    SET is_active = false, updated_at = now()
    WHERE id = $1
    RETURNING id, sku, name, base_unit, is_active, created_at, updated_at;
  `;

  const result = await db.query(query, [id]);
  const row = result.rows[0];

  const hasTx = await checkProductHasTransactions(id, client);

  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    baseUnit: row.base_unit,
    isActive: row.is_active,
    hasTransactions: hasTx,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
