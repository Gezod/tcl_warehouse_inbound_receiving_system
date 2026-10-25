import dotenv from 'dotenv';
import { getPool, closePool } from '../src/server/db/pool';

dotenv.config();

async function verifyConsistency() {
  const pool = getPool();
  console.log('--- Warehouse Receiving System: Data Consistency Verifier (NFR-01) ---');

  let hasError = false;

  try {
    // 1. NFR-01: On-hand equals sum of RECEIPT transactions
    console.log('\n[Check 1/3] Verifying NFR-01: Product stock equals sum of receipt transactions...');
    const check1 = await pool.query(`
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
    `);

    if (check1.rows.length === 0) {
      console.log('✓ PASS: All product stock quantities match receipt transactions.');
    } else {
      hasError = true;
      console.error(`✗ FAIL: ${check1.rows.length} product(s) have discrepancy between stock and transactions:`, check1.rows);
    }

    // 2. Line cache invariant: line.received_qty equals sum of line receipts
    console.log('\n[Check 2/3] Verifying Line Cache Invariant: line.received_qty = sum(receipts)...');
    const check2 = await pool.query(`
      SELECT l.id, l.document_id, l.received_qty, COALESCE(SUM(r.received_qty), 0) AS receipts_sum
      FROM receiving_lines l
      LEFT JOIN receipts r ON r.line_id = l.id
      GROUP BY l.id, l.document_id, l.received_qty
      HAVING l.received_qty <> COALESCE(SUM(r.received_qty), 0);
    `);

    if (check2.rows.length === 0) {
      console.log('✓ PASS: All receiving lines have received_qty equal to their receipt records.');
    } else {
      hasError = true;
      console.error(`✗ FAIL: ${check2.rows.length} line(s) have cache discrepancy:`, check2.rows);
    }

    // 3. Document status consistency with receipts & completion
    console.log('\n[Check 3/3] Verifying Document Status & Lifecycle Invariants...');
    const partialNoReceipts = await pool.query(`
      SELECT d.id, d.document_number
      FROM receiving_documents d
      WHERE d.status = 'PARTIALLY_RECEIVED' AND NOT EXISTS (
        SELECT 1 FROM receipts r WHERE r.document_id = d.id
      );
    `);

    const cancelledWithReceipts = await pool.query(`
      SELECT d.id, d.document_number
      FROM receiving_documents d
      WHERE d.status = 'CANCELLED' AND EXISTS (
        SELECT 1 FROM receipts r WHERE r.document_id = d.id
      );
    `);

    const completedWithShortLines = await pool.query(`
      SELECT d.id, d.document_number, l.id as line_id, l.expected_qty, l.received_qty
      FROM receiving_documents d
      JOIN receiving_lines l ON l.document_id = d.id
      WHERE d.status = 'COMPLETED' AND l.received_qty <> l.expected_qty;
    `);

    if (
      partialNoReceipts.rows.length === 0 &&
      cancelledWithReceipts.rows.length === 0 &&
      completedWithShortLines.rows.length === 0
    ) {
      console.log('✓ PASS: All document statuses comply with receipt and lifecycle invariants.');
    } else {
      hasError = true;
      if (partialNoReceipts.rows.length > 0) {
        console.error(`✗ FAIL: PARTIALLY_RECEIVED documents without receipts:`, partialNoReceipts.rows);
      }
      if (cancelledWithReceipts.rows.length > 0) {
        console.error(`✗ FAIL: CANCELLED documents with recorded receipts:`, cancelledWithReceipts.rows);
      }
      if (completedWithShortLines.rows.length > 0) {
        console.error(`✗ FAIL: COMPLETED documents with unfulfilled lines:`, completedWithShortLines.rows);
      }
    }

    if (hasError) {
      console.error('\nConsistency check FAILED. One or more data integrity invariants violated.');
      process.exit(1);
    } else {
      console.log('\n✓ Consistency check PASSED: All data invariants satisfied.');
      process.exit(0);
    }
  } catch (err) {
    console.error('Error executing consistency checks:', err);
    process.exit(1);
  } finally {
    await closePool();
  }
}

verifyConsistency();
