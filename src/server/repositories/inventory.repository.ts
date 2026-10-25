import { PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { InventoryItem } from '@/src/types/domain';

export async function findInventory(
  options: {
    q?: string;
    page: number;
    pageSize: number;
  },
  client?: PoolClient
): Promise<{ items: InventoryItem[]; total: number }> {
  const db = client || getPool();
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (options.q && options.q.trim()) {
    conditions.push(
      `(p.sku ILIKE $${paramIndex} OR p.name ILIKE $${paramIndex})`
    );
    params.push(`%${options.q.trim()}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 1. Total count
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM products p
    ${whereClause};
  `;
  const countResult = await db.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  // 2. Data with on_hand computation from transactions (Tech Spec 3.2, NFR-01)
  const offset = (options.page - 1) * options.pageSize;
  params.push(options.pageSize);
  const limitParam = paramIndex++;
  params.push(offset);
  const offsetParam = paramIndex++;

  const dataQuery = `
    SELECT 
      p.id AS product_id,
      p.sku,
      p.name,
      p.base_unit,
      p.is_active,
      COALESCE(SUM(t.quantity), 0)::int AS on_hand_qty,
      MAX(t.created_at) AS last_movement_at
    FROM products p
    LEFT JOIN inventory_transactions t ON t.product_id = p.id AND t.type = 'RECEIPT'
    ${whereClause}
    GROUP BY p.id
    ORDER BY p.sku ASC
    LIMIT $${limitParam} OFFSET $${offsetParam};
  `;

  const result = await db.query(dataQuery, params);

  const items: InventoryItem[] = result.rows.map((row) => ({
    productId: row.product_id,
    sku: row.sku,
    name: row.name,
    baseUnit: row.base_unit,
    isActive: row.is_active,
    onHandQty: row.on_hand_qty,
    availableQty: row.on_hand_qty, // A-05: equals onHandQty in v1
    lastMovementAt: row.last_movement_at ? row.last_movement_at.toISOString() : null,
  }));

  return { items, total };
}
