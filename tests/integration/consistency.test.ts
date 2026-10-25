import { describe, it, expect, afterAll } from 'vitest';
import dotenv from 'dotenv';
import { getPool, closePool } from '@/src/server/db/pool';

dotenv.config();

describe('Data Consistency & Invariant Checks (Tech Spec 13.5, NFR-01)', () => {
  afterAll(async () => {
    await closePool();
  });

  /**
   * Tech Spec 13.5 Query 1:
   * NFR-01: On-hand quantity must equal the sum of RECEIPT transactions for every product.
   * Compares product on-hand transactions to sum of line receipts.
   */
  it('satisfies NFR-01: on-hand inventory equals sum of RECEIPT transactions and receipts for every product', async () => {
    const pool = getPool();
    const query = `
      SELECT p.id, p.sku,
             COALESCE(SUM(t.quantity), 0) AS tx_qty,
             (
               SELECT COALESCE(SUM(r.received_qty), 0)
               FROM receipts r
               JOIN receiving_lines l ON l.id = r.line_id
               WHERE l.product_id = p.id
             ) AS receipts_qty
      FROM products p
      LEFT JOIN inventory_transactions t ON t.product_id = p.id AND t.type = 'RECEIPT'
      GROUP BY p.id, p.sku
      HAVING COALESCE(SUM(t.quantity), 0) <> (
        SELECT COALESCE(SUM(r.received_qty), 0)
        FROM receipts r
        JOIN receiving_lines l ON l.id = r.line_id
        WHERE l.product_id = p.id
      );
    `;

    const res = await pool.query(query);
    expect(res.rows).toEqual([]);
  });

  /**
   * Tech Spec 13.5 Query 2:
   * Line cache invariant: received_qty on receiving_lines must equal the sum of receipts for that line.
   */
  it('satisfies line cache invariant: line.received_qty equals sum of line receipts', async () => {
    const pool = getPool();
    const query = `
      SELECT l.id, l.document_id, l.received_qty, COALESCE(SUM(r.received_qty), 0) AS receipts_sum
      FROM receiving_lines l
      LEFT JOIN receipts r ON r.line_id = l.id
      GROUP BY l.id, l.document_id, l.received_qty
      HAVING l.received_qty <> COALESCE(SUM(r.received_qty), 0);
    `;

    const res = await pool.query(query);
    expect(res.rows).toEqual([]);
  });

  /**
   * Tech Spec 13.5 Query 3:
   * Document status consistent with receipts:
   * - PARTIALLY_RECEIVED document must have at least one receipt.
   * - CANCELLED document must have zero receipts (BR-07).
   * - COMPLETED document must have received_qty equal to expected_qty on every line (BR-06).
   */
  it('satisfies document status invariants with receipts and completion', async () => {
    const pool = getPool();

    // 1. PARTIALLY_RECEIVED has at least 1 receipt
    const partialNoReceipts = await pool.query(`
      SELECT d.id, d.document_number
      FROM receiving_documents d
      WHERE d.status = 'PARTIALLY_RECEIVED' AND NOT EXISTS (
        SELECT 1 FROM receipts r WHERE r.document_id = d.id
      );
    `);
    expect(partialNoReceipts.rows).toEqual([]);

    // 2. CANCELLED has 0 receipts (BR-07)
    const cancelledWithReceipts = await pool.query(`
      SELECT d.id, d.document_number
      FROM receiving_documents d
      WHERE d.status = 'CANCELLED' AND EXISTS (
        SELECT 1 FROM receipts r WHERE r.document_id = d.id
      );
    `);
    expect(cancelledWithReceipts.rows).toEqual([]);

    // 3. COMPLETED documents have all lines fully received (BR-06)
    const completedWithShortLines = await pool.query(`
      SELECT d.id, d.document_number, l.id as line_id, l.expected_qty, l.received_qty
      FROM receiving_documents d
      JOIN receiving_lines l ON l.document_id = d.id
      WHERE d.status = 'COMPLETED' AND l.received_qty <> l.expected_qty;
    `);
    expect(completedWithShortLines.rows).toEqual([]);
  });
});
