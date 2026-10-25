import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';
import { NextRequest } from 'next/server';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { POST as createProductRoute } from '@/app/api/products/route';
import {
  POST as createDocRoute,
} from '@/app/api/receiving-documents/route';
import {
  POST as addLineRoute,
} from '@/app/api/receiving-documents/[documentId]/lines/route';
import {
  POST as submitDocRoute,
} from '@/app/api/receiving-documents/[documentId]/submit/route';
import {
  POST as recordReceiptsRoute,
} from '@/app/api/receiving-documents/[documentId]/receipts/route';
import { getPool, closePool } from '@/src/server/db/pool';

dotenv.config();

describe('Concurrency Tests (Tech Spec 13.3 & 13.4, NFR-02)', () => {
  let supervisorCookie: string;
  let operatorCookie: string;
  const runId = Math.random().toString(36).substring(2, 7).toUpperCase();

  beforeAll(async () => {
    const pool = getPool();
    const client = await pool.connect();
    client.release();

    // Authenticate as Supervisor
    const supLoginRes = await loginRoute(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: 'supervisor',
          password: 'SupervisorPass123!',
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(supLoginRes.status).toBe(200);
    supervisorCookie = supLoginRes.headers.get('set-cookie')!.split(';')[0];

    // Authenticate as Operator
    const opLoginRes = await loginRoute(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: 'operator',
          password: 'OperatorPass123!',
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(opLoginRes.status).toBe(200);
    operatorCookie = opLoginRes.headers.get('set-cookie')!.split(';')[0];
  });

  afterAll(async () => {
    await closePool();
  });

  /**
   * Tech Spec 13.3 Concurrency Test:
   * Setup: one product, one document in OPEN with one line expected 10.
   * Action: 20 receipt requests with distinct idempotency keys, each for quantity 1, sent in parallel.
   * Expected: exactly 10 succeed with 201, exactly 10 fail with 422 OVER_RECEIPT,
   * line ends with received_qty = 10, exactly 10 receipt rows and 10 inventory transactions.
   */
  it('handles 20 concurrent receipt requests on a line with expectedQty 10 without race condition or over-receipt', async () => {
    // 1. Create product
    const sku = `CONC-SKU-${runId}-1`;
    const prodRes = await createProductRoute(
      new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify({
          sku,
          name: 'Concurrent Race Test Product',
          baseUnit: 'pcs',
        }),
        headers: {
          Cookie: supervisorCookie,
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
      })
    );
    expect(prodRes.status).toBe(201);
    const prod = await prodRes.json();

    // 2. Create document
    const docRes = await createDocRoute(
      new NextRequest('http://localhost:3000/api/receiving-documents', {
        method: 'POST',
        body: JSON.stringify({
          supplierName: `Concurrent Supplier ${runId}`,
          expectedArrivalDate: '2026-11-01',
        }),
        headers: {
          Cookie: operatorCookie,
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
      })
    );
    expect(docRes.status).toBe(201);
    const doc = await docRes.json();

    // 3. Add line with expectedQty = 10
    const lineRes = await addLineRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/lines`, {
        method: 'POST',
        body: JSON.stringify({
          productId: prod.id,
          expectedQty: 10,
        }),
        headers: {
          Cookie: operatorCookie,
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
      }),
      { params: { documentId: doc.id } }
    );
    expect(lineRes.status).toBe(201);
    const line = await lineRes.json();

    // 4. Submit document -> OPEN
    const submitRes = await submitDocRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/submit`, {
        method: 'POST',
        headers: {
          Cookie: operatorCookie,
          Origin: 'http://localhost:3000',
        },
      }),
      { params: { documentId: doc.id } }
    );
    expect(submitRes.status).toBe(200);

    // 5. Send 20 receipt requests in parallel, each for quantity 1 with unique idempotency keys
    const requests = Array.from({ length: 20 }, (_, i) => {
      const idempotencyKey = `conc-key-${runId}-req-${i}-${Math.random().toString(36).substring(2, 9)}`;
      const nowIso = new Date().toISOString();

      return recordReceiptsRoute(
        new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/receipts`, {
          method: 'POST',
          body: JSON.stringify({
            receivedAt: nowIso,
            items: [{ lineId: line.id, receivedQty: 1 }],
          }),
          headers: {
            Cookie: operatorCookie,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
            Origin: 'http://localhost:3000',
          },
        }),
        { params: { documentId: doc.id } }
      );
    });

    const responses = await Promise.all(requests);

    const statuses = responses.map((r) => r.status);
    const count201 = statuses.filter((s) => s === 201).length;
    const count422 = statuses.filter((s) => s === 422).length;

    // Verify: exactly 10 succeed, exactly 10 fail with 422
    expect(count201).toBe(10);
    expect(count422).toBe(10);

    // Verify database state: line received_qty = 10
    const pool = getPool();
    const lineDbRes = await pool.query(
      `SELECT received_qty FROM receiving_lines WHERE id = $1;`,
      [line.id]
    );
    expect(lineDbRes.rows[0].received_qty).toBe(10);

    // Verify receipts count = 10
    const receiptsDbRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM receipts WHERE line_id = $1;`,
      [line.id]
    );
    expect(receiptsDbRes.rows[0].count).toBe(10);

    // Verify inventory_transactions count = 10
    const txDbRes = await pool.query(
      `SELECT COUNT(*)::int as count, SUM(quantity)::int as total_qty FROM inventory_transactions WHERE product_id = $1;`,
      [prod.id]
    );
    expect(txDbRes.rows[0].count).toBe(10);
    expect(txDbRes.rows[0].total_qty).toBe(10);
  });

  /**
   * Tech Spec 13.4 Idempotency under concurrency:
   * Send 10 parallel requests with the same key and body.
   * Expected: all return the same body, exactly one receipt batch exists, and the line is increased once.
   */
  it('handles 10 parallel requests with identical idempotency key and body without duplicate writes', async () => {
    // 1. Create product
    const sku = `CONC-IDEM-${runId}-2`;
    const prodRes = await createProductRoute(
      new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify({
          sku,
          name: 'Concurrent Idempotency Product',
          baseUnit: 'pcs',
        }),
        headers: {
          Cookie: supervisorCookie,
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
      })
    );
    expect(prodRes.status).toBe(201);
    const prod = await prodRes.json();

    // 2. Create document & line
    const docRes = await createDocRoute(
      new NextRequest('http://localhost:3000/api/receiving-documents', {
        method: 'POST',
        body: JSON.stringify({
          supplierName: `Idempotency Supplier ${runId}`,
        }),
        headers: {
          Cookie: operatorCookie,
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
      })
    );
    expect(docRes.status).toBe(201);
    const doc = await docRes.json();

    const lineRes = await addLineRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/lines`, {
        method: 'POST',
        body: JSON.stringify({
          productId: prod.id,
          expectedQty: 50,
        }),
        headers: {
          Cookie: operatorCookie,
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
      }),
      { params: { documentId: doc.id } }
    );
    expect(lineRes.status).toBe(201);
    const line = await lineRes.json();

    // Submit document
    await submitDocRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/submit`, {
        method: 'POST',
        headers: {
          Cookie: operatorCookie,
          Origin: 'http://localhost:3000',
        },
      }),
      { params: { documentId: doc.id } }
    );

    // 3. Send 10 requests with identical idempotency key and payload
    const sharedKey = `shared-idempotency-key-${runId}`;
    const fixedReceivedAt = new Date().toISOString();
    const payload = JSON.stringify({
      receivedAt: fixedReceivedAt,
      items: [{ lineId: line.id, receivedQty: 5 }],
    });

    const requests = Array.from({ length: 10 }, () =>
      recordReceiptsRoute(
        new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/receipts`, {
          method: 'POST',
          body: payload,
          headers: {
            Cookie: operatorCookie,
            'Content-Type': 'application/json',
            'Idempotency-Key': sharedKey,
            Origin: 'http://localhost:3000',
          },
        }),
        { params: { documentId: doc.id } }
      )
    );

    const responses = await Promise.all(requests);

    // All must be successful (201 for the original or 200 for cached replay)
    for (const res of responses) {
      expect([200, 201]).toContain(res.status);
    }

    // Database verification: exactly 1 batch of receipts (receivedQty 5)
    const pool = getPool();
    const lineDbRes = await pool.query(
      `SELECT received_qty FROM receiving_lines WHERE id = $1;`,
      [line.id]
    );
    expect(lineDbRes.rows[0].received_qty).toBe(5);

    const receiptsDbRes = await pool.query(
      `SELECT COUNT(*)::int as count, SUM(received_qty)::int as total_qty FROM receipts WHERE line_id = $1;`,
      [line.id]
    );
    expect(receiptsDbRes.rows[0].count).toBe(1);
    expect(receiptsDbRes.rows[0].total_qty).toBe(5);

    const txDbRes = await pool.query(
      `SELECT COUNT(*)::int as count, SUM(quantity)::int as total_qty FROM inventory_transactions WHERE product_id = $1;`,
      [prod.id]
    );
    expect(txDbRes.rows[0].count).toBe(1);
    expect(txDbRes.rows[0].total_qty).toBe(5);
  });
});
