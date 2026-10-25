import { PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { ReceivingLine } from '@/src/types/domain';

export async function checkProductOnDocument(
  documentId: string,
  productId: string,
  client?: PoolClient
): Promise<boolean> {
  const db = client || getPool();
  const query = `
    SELECT 1
    FROM receiving_lines
    WHERE document_id = $1 AND product_id = $2
    LIMIT 1;
  `;
  const result = await db.query(query, [documentId, productId]);
  return result.rows.length > 0;
}

export async function countLinesForDocument(
  documentId: string,
  client?: PoolClient
): Promise<number> {
  const db = client || getPool();
  const query = `
    SELECT COUNT(*)::int AS count
    FROM receiving_lines
    WHERE document_id = $1;
  `;
  const result = await db.query(query, [documentId]);
  return result.rows[0]?.count || 0;
}

export async function findLineById(
  lineId: string,
  client?: PoolClient
): Promise<(ReceivingLine & { productId: string }) | null> {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(lineId)) {
    return null;
  }

  const db = client || getPool();
  const query = `
    SELECT 
      l.id,
      l.document_id,
      l.product_id,
      l.expected_qty,
      l.received_qty,
      l.created_at,
      p.sku AS product_sku,
      p.name AS product_name
    FROM receiving_lines l
    JOIN products p ON p.id = l.product_id
    WHERE l.id = $1
    LIMIT 1;
  `;
  const result = await db.query(query, [lineId]);
  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    documentId: row.document_id,
    productId: row.product_id,
    product: {
      id: row.product_id,
      sku: row.product_sku,
      name: row.product_name,
    },
    expectedQty: row.expected_qty,
    receivedQty: row.received_qty,
    remainingQty: Math.max(0, row.expected_qty - row.received_qty),
    createdAt: row.created_at.toISOString(),
  };
}

export async function createReceivingLine(
  documentId: string,
  productId: string,
  expectedQty: number,
  client?: PoolClient
): Promise<ReceivingLine> {
  const db = client || getPool();
  const insertQuery = `
    INSERT INTO receiving_lines (document_id, product_id, expected_qty, received_qty, created_at, updated_at)
    VALUES ($1, $2, $3, 0, now(), now())
    RETURNING id, document_id, expected_qty, received_qty, created_at;
  `;
  const insertResult = await db.query(insertQuery, [documentId, productId, expectedQty]);
  const row = insertResult.rows[0];

  const prodQuery = `SELECT id, sku, name FROM products WHERE id = $1;`;
  const prodResult = await db.query(prodQuery, [productId]);
  const prodRow = prodResult.rows[0];

  return {
    id: row.id,
    documentId: row.document_id,
    product: {
      id: prodRow.id,
      sku: prodRow.sku,
      name: prodRow.name,
    },
    expectedQty: row.expected_qty,
    receivedQty: row.received_qty,
    remainingQty: row.expected_qty - row.received_qty,
    createdAt: row.created_at.toISOString(),
  };
}

export async function updateLineExpectedQty(
  lineId: string,
  newExpectedQty: number,
  client?: PoolClient
): Promise<ReceivingLine> {
  const db = client || getPool();
  const updateQuery = `
    UPDATE receiving_lines
    SET expected_qty = $2, updated_at = now()
    WHERE id = $1
    RETURNING id, document_id, product_id, expected_qty, received_qty, created_at;
  `;
  const result = await db.query(updateQuery, [lineId, newExpectedQty]);
  const row = result.rows[0];

  const prodQuery = `SELECT id, sku, name FROM products WHERE id = $1;`;
  const prodResult = await db.query(prodQuery, [row.product_id]);
  const prodRow = prodResult.rows[0];

  return {
    id: row.id,
    documentId: row.document_id,
    product: {
      id: prodRow.id,
      sku: prodRow.sku,
      name: prodRow.name,
    },
    expectedQty: row.expected_qty,
    receivedQty: row.received_qty,
    remainingQty: Math.max(0, row.expected_qty - row.received_qty),
    createdAt: row.created_at.toISOString(),
  };
}

export async function deleteReceivingLine(
  lineId: string,
  client?: PoolClient
): Promise<void> {
  const db = client || getPool();
  const query = `
    DELETE FROM receiving_lines
    WHERE id = $1;
  `;
  await db.query(query, [lineId]);
}
