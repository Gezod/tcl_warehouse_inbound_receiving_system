import { PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { InventoryTransaction } from '@/src/types/domain';

export async function findInventoryTransactions(
  options: {
    productId?: string;
    documentId?: string;
    dateFrom?: string;
    dateTo?: string;
    page: number;
    pageSize: number;
  },
  client?: PoolClient
): Promise<{ transactions: InventoryTransaction[]; total: number }> {
  const db = client || getPool();
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (options.productId) {
    conditions.push(`t.product_id = $${paramIndex}`);
    params.push(options.productId);
    paramIndex++;
  }

  if (options.documentId) {
    conditions.push(`t.document_id = $${paramIndex}`);
    params.push(options.documentId);
    paramIndex++;
  }

  if (options.dateFrom) {
    conditions.push(`t.created_at >= $${paramIndex}::timestamptz`);
    params.push(options.dateFrom);
    paramIndex++;
  }

  if (options.dateTo) {
    conditions.push(`t.created_at < $${paramIndex}::timestamptz`);
    params.push(options.dateTo);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 1. Total count
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM inventory_transactions t
    ${whereClause};
  `;
  const countResult = await db.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  // 2. Data with joined sku and documentNumber
  const offset = (options.page - 1) * options.pageSize;
  params.push(options.pageSize);
  const limitParam = paramIndex++;
  params.push(offset);
  const offsetParam = paramIndex++;

  const dataQuery = `
    SELECT 
      t.id,
      t.type,
      t.product_id,
      p.sku,
      t.quantity,
      t.document_id,
      d.document_number,
      t.line_id,
      t.receipt_id,
      t.created_by,
      t.created_at
    FROM inventory_transactions t
    JOIN products p ON p.id = t.product_id
    JOIN receiving_documents d ON d.id = t.document_id
    ${whereClause}
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT $${limitParam} OFFSET $${offsetParam};
  `;

  const result = await db.query(dataQuery, params);

  const transactions: InventoryTransaction[] = result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    productId: row.product_id,
    sku: row.sku,
    quantity: row.quantity,
    documentId: row.document_id,
    documentNumber: row.document_number,
    lineId: row.line_id,
    receiptId: row.receipt_id,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  }));

  return { transactions, total };
}
