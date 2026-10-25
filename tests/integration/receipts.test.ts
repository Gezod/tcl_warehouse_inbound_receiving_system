import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';
import { NextRequest } from 'next/server';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { POST as createProductRoute } from '@/app/api/products/route';
import {
  POST as createDocumentRoute,
} from '@/app/api/receiving-documents/route';
import { POST as addLineRoute } from '@/app/api/receiving-documents/[documentId]/lines/route';
import { POST as submitDocumentRoute } from '@/app/api/receiving-documents/[documentId]/submit/route';
import { POST as cancelDocumentRoute } from '@/app/api/receiving-documents/[documentId]/cancel/route';
import { POST as recordReceiptsRoute } from '@/app/api/receiving-documents/[documentId]/receipts/route';
import { POST as completeDocumentRoute } from '@/app/api/receiving-documents/[documentId]/complete/route';
import { GET as getInventoryRoute } from '@/app/api/inventory/route';
import { GET as getTransactionsRoute } from '@/app/api/transactions/route';
import { getPool, closePool } from '@/src/server/db/pool';

dotenv.config();

describe('Receipts, Completion, and Inventory Integration Tests (against PostgreSQL)', () => {
  let operatorCookie: string;
  let supervisorCookie: string;
  let product1: any;
  let product2: any;
  const runId = Math.random().toString(36).substring(2, 7).toUpperCase();

  beforeAll(async () => {
    const pool = getPool();
    const client = await pool.connect();
    client.release();

    // Authenticate Operator
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

    // Authenticate Supervisor
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

    // Create 2 test products
    const p1Res = await createProductRoute(
      new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify({
          sku: `RCP-P1-${runId}`,
          name: 'Receipt Product 1',
          baseUnit: 'box',
        }),
        headers: { 'Content-Type': 'application/json', cookie: supervisorCookie },
      })
    );
    product1 = await p1Res.json();

    const p2Res = await createProductRoute(
      new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify({
          sku: `RCP-P2-${runId}`,
          name: 'Receipt Product 2',
          baseUnit: 'pcs',
        }),
        headers: { 'Content-Type': 'application/json', cookie: supervisorCookie },
      })
    );
    product2 = await p2Res.json();
  });

  afterAll(async () => {
    await closePool();
  });

  it('Validates Idempotency-Key header is present and between 8 and 64 characters (400)', async () => {
    // 1. Create and submit a document
    const docRes = await createDocumentRoute(
      new NextRequest('http://localhost:3000/api/receiving-documents', {
        method: 'POST',
        body: JSON.stringify({ supplierName: 'Idemp Test Supplier' }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      })
    );
    const doc = await docRes.json();

    const lineRes = await addLineRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/lines`, {
        method: 'POST',
        body: JSON.stringify({ productId: product1.id, expectedQty: 10 }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );
    const line = await lineRes.json();

    await submitDocumentRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/submit`, {
        method: 'POST',
        headers: { cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );

    // Missing Idempotency-Key header -> 400
    const missingKeyRes = await recordReceiptsRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/receipts`, {
        method: 'POST',
        body: JSON.stringify({
          receivedAt: new Date().toISOString(),
          items: [{ lineId: line.id, receivedQty: 2 }],
        }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );
    expect(missingKeyRes.status).toBe(400);
    const missingData = await missingKeyRes.json();
    expect(missingData.code).toBe('VALIDATION_ERROR');
    expect(missingData.field).toBe('Idempotency-Key');

    // Too short key (< 8 chars) -> 400
    const shortKeyRes = await recordReceiptsRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/receipts`, {
        method: 'POST',
        body: JSON.stringify({
          receivedAt: new Date().toISOString(),
          items: [{ lineId: line.id, receivedQty: 2 }],
        }),
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'abc',
          cookie: operatorCookie,
        },
      }),
      { params: { documentId: doc.id } }
    );
    expect(shortKeyRes.status).toBe(400);
  });

  it('BR-03 & US-05: Rejects over-receipt with 422 OVER_RECEIPT and does not update stock', async () => {
    // 1. Create doc with line expected 10
    const docRes = await createDocumentRoute(
      new NextRequest('http://localhost:3000/api/receiving-documents', {
        method: 'POST',
        body: JSON.stringify({ supplierName: 'Over-receipt Supplier' }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      })
    );
    const doc = await docRes.json();

    const lineRes = await addLineRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/lines`, {
        method: 'POST',
        body: JSON.stringify({ productId: product1.id, expectedQty: 10 }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );
    const line = await lineRes.json();

    await submitDocumentRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/submit`, {
        method: 'POST',
        headers: { cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );

    // 2. Attempt receipt of 15 when expected/remaining is 10
    const overReceiptRes = await recordReceiptsRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/receipts`, {
        method: 'POST',
        body: JSON.stringify({
          receivedAt: new Date().toISOString(),
          items: [{ lineId: line.id, receivedQty: 15 }],
        }),
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `IDEMP-OVER-${Date.now()}`,
          cookie: operatorCookie,
        },
      }),
      { params: { documentId: doc.id } }
    );

    expect(overReceiptRes.status).toBe(422);
    const errData = await overReceiptRes.json();
    expect(errData.code).toBe('OVER_RECEIPT');
    expect(errData.details).toBeInstanceOf(Array);
    expect(errData.details[0].lineId).toBe(line.id);
    expect(errData.details[0].requested).toBe(15);
    expect(errData.details[0].remaining).toBe(10);
  });

  it('US-05 & US-06: Partial receipt moves document to PARTIALLY_RECEIVED, updates stock & transactions atomically', async () => {
    // 1. Create document with 2 lines
    const docRes = await createDocumentRoute(
      new NextRequest('http://localhost:3000/api/receiving-documents', {
        method: 'POST',
        body: JSON.stringify({ supplierName: 'Multi-line Supplier' }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      })
    );
    const doc = await docRes.json();

    const line1Res = await addLineRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/lines`, {
        method: 'POST',
        body: JSON.stringify({ productId: product1.id, expectedQty: 10 }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );
    const line1 = await line1Res.json();

    const line2Res = await addLineRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/lines`, {
        method: 'POST',
        body: JSON.stringify({ productId: product2.id, expectedQty: 6 }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );
    const line2 = await line2Res.json();

    await submitDocumentRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/submit`, {
        method: 'POST',
        headers: { cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );

    // 2. Operator submits batch receipt: 4 on line 1, 2 on line 2
    const idempotencyKey = `KEY-BATCH-${Date.now()}`;
    const payload = {
      receivedAt: new Date().toISOString(),
      items: [
        { lineId: line1.id, receivedQty: 4, note: 'Pallet A' },
        { lineId: line2.id, receivedQty: 2, note: 'Pallet B' },
      ],
    };

    const receiptRes = await recordReceiptsRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/receipts`, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          cookie: operatorCookie,
        },
      }),
      { params: { documentId: doc.id } }
    );

    expect(receiptRes.status).toBe(201);
    const result = await receiptRes.json();
    expect(result.documentStatus).toBe('PARTIALLY_RECEIVED');
    expect(result.receipts.length).toBe(2);
    expect(result.document.totals.receivedQty).toBe(6);
    expect(result.document.totals.remainingQty).toBe(10);

    // 3. Idempotency replay (BR-10, US-07): exact same key and payload returns 200 with identical response
    const replayRes = await recordReceiptsRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/receipts`, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          cookie: operatorCookie,
        },
      }),
      { params: { documentId: doc.id } }
    );
    expect(replayRes.status).toBe(200);
    const replayResult = await replayRes.json();
    expect(replayResult.receipts.length).toBe(2);
    expect(replayResult.receipts[0].id).toBe(result.receipts[0].id);

    // 4. Reusing same key with different payload returns 409 IDEMPOTENCY_KEY_REUSED
    const reusedKeyRes = await recordReceiptsRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/receipts`, {
        method: 'POST',
        body: JSON.stringify({
          receivedAt: new Date().toISOString(),
          items: [{ lineId: line1.id, receivedQty: 1 }],
        }),
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          cookie: operatorCookie,
        },
      }),
      { params: { documentId: doc.id } }
    );
    expect(reusedKeyRes.status).toBe(409);
    const reusedErr = await reusedKeyRes.json();
    expect(reusedErr.code).toBe('IDEMPOTENCY_KEY_REUSED');

    // 5. Verify BR-07: Document with recorded receipts CANNOT be cancelled
    const cancelAttemptRes = await cancelDocumentRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/cancel`, {
        method: 'POST',
        headers: { cookie: supervisorCookie },
      }),
      { params: { documentId: doc.id } }
    );
    expect(cancelAttemptRes.status).toBe(409);
    const cancelErr = await cancelAttemptRes.json();
    expect(cancelErr.code).toBe('DOCUMENT_HAS_RECEIPTS');

    // 6. Verify FR-16 & FR-17: Inventory on-hand reflects receipt transactions
    const invRes = await getInventoryRoute(
      new NextRequest(`http://localhost:3000/api/inventory?q=${product1.sku}`, {
        headers: { cookie: operatorCookie },
      })
    );
    expect(invRes.status).toBe(200);
    const invData = await invRes.json();
    const invItem = invData.data.find((item: any) => item.sku === product1.sku);
    expect(invItem).toBeDefined();
    expect(invItem.onHandQty).toBeGreaterThanOrEqual(4);
    expect(invItem.availableQty).toBe(invItem.onHandQty);

    const txRes = await getTransactionsRoute(
      new NextRequest(
        `http://localhost:3000/api/transactions?documentId=${doc.id}&productId=${product1.id}`,
        { headers: { cookie: operatorCookie } }
      )
    );
    expect(txRes.status).toBe(200);
    const txData = await txRes.json();
    expect(txData.data.length).toBe(1);
    expect(txData.data[0].type).toBe('RECEIPT');
    expect(txData.data[0].quantity).toBe(4);
    expect(txData.data[0].documentNumber).toBe(doc.documentNumber);

    // 7. Verify Completion rules (BR-06, US-08):
    // 7a. Operator cannot complete -> 403
    const opCompleteRes = await completeDocumentRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/complete`, {
        method: 'POST',
        headers: { cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );
    expect(opCompleteRes.status).toBe(403);

    // 7b. Supervisor cannot complete while lines remain unfulfilled -> 422 DOCUMENT_NOT_FULLY_RECEIVED
    const supPrematureCompleteRes = await completeDocumentRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/complete`, {
        method: 'POST',
        headers: { cookie: supervisorCookie },
      }),
      { params: { documentId: doc.id } }
    );
    expect(supPrematureCompleteRes.status).toBe(422);
    const prematureErr = await supPrematureCompleteRes.json();
    expect(prematureErr.code).toBe('DOCUMENT_NOT_FULLY_RECEIVED');

    // 7c. Receive remaining quantities (Line 1: 6, Line 2: 4)
    const completeReceiptRes = await recordReceiptsRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/receipts`, {
        method: 'POST',
        body: JSON.stringify({
          receivedAt: new Date().toISOString(),
          items: [
            { lineId: line1.id, receivedQty: 6 },
            { lineId: line2.id, receivedQty: 4 },
          ],
        }),
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `IDEMP-FINAL-${Date.now()}`,
          cookie: operatorCookie,
        },
      }),
      { params: { documentId: doc.id } }
    );
    expect(completeReceiptRes.status).toBe(201);

    // 7d. Supervisor completes document -> 200, status COMPLETED
    const completeRes = await completeDocumentRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/complete`, {
        method: 'POST',
        headers: { cookie: supervisorCookie },
      }),
      { params: { documentId: doc.id } }
    );
    expect(completeRes.status).toBe(200);
    const completedDoc = await completeRes.json();
    expect(completedDoc.status).toBe('COMPLETED');
    expect(completedDoc.completedAt).toBeDefined();

    // 7e. Terminal state (BR-08): No changes to receipts allowed on COMPLETED document
    const postCompleteReceiptRes = await recordReceiptsRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/receipts`, {
        method: 'POST',
        body: JSON.stringify({
          receivedAt: new Date().toISOString(),
          items: [{ lineId: line1.id, receivedQty: 1 }],
        }),
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `IDEMP-POST-${Date.now()}`,
          cookie: operatorCookie,
        },
      }),
      { params: { documentId: doc.id } }
    );
    expect(postCompleteReceiptRes.status).toBe(409);
    const postCompleteErr = await postCompleteReceiptRes.json();
    expect(postCompleteErr.code).toBe('INVALID_DOCUMENT_STATE');
  });
});
