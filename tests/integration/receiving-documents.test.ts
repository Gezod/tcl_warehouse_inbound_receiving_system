import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';
import { NextRequest } from 'next/server';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { POST as createProductRoute } from '@/app/api/products/route';
import { POST as deactivateProductRoute } from '@/app/api/products/[productId]/deactivate/route';
import {
  GET as getDocumentsRoute,
  POST as createDocumentRoute,
} from '@/app/api/receiving-documents/route';
import {
  GET as getDocumentDetailRoute,
  PATCH as updateDocumentHeaderRoute,
} from '@/app/api/receiving-documents/[documentId]/route';
import { POST as addLineRoute } from '@/app/api/receiving-documents/[documentId]/lines/route';
import {
  PATCH as updateLineRoute,
  DELETE as deleteLineRoute,
} from '@/app/api/receiving-documents/[documentId]/lines/[lineId]/route';
import { POST as submitDocumentRoute } from '@/app/api/receiving-documents/[documentId]/submit/route';
import { POST as cancelDocumentRoute } from '@/app/api/receiving-documents/[documentId]/cancel/route';
import { getPool, closePool } from '@/src/server/db/pool';

dotenv.config();

describe('Receiving Documents API Integration Tests (against PostgreSQL)', () => {
  let operatorCookie: string;
  let supervisorCookie: string;
  let activeProduct1: any;
  let activeProduct2: any;
  let inactiveProduct: any;

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

    // Create test products
    const timestamp = Date.now().toString().slice(-6);
    const p1Res = await createProductRoute(
      new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify({
          sku: `RD-TEST-${timestamp}-A`,
          name: 'RD Test Product A',
          baseUnit: 'box',
        }),
        headers: { 'Content-Type': 'application/json', cookie: supervisorCookie },
      })
    );
    activeProduct1 = await p1Res.json();

    const p2Res = await createProductRoute(
      new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify({
          sku: `RD-TEST-${timestamp}-B`,
          name: 'RD Test Product B',
          baseUnit: 'pcs',
        }),
        headers: { 'Content-Type': 'application/json', cookie: supervisorCookie },
      })
    );
    activeProduct2 = await p2Res.json();

    const p3Res = await createProductRoute(
      new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify({
          sku: `RD-INACT-${timestamp}`,
          name: 'RD Inactive Product',
          baseUnit: 'pcs',
        }),
        headers: { 'Content-Type': 'application/json', cookie: supervisorCookie },
      })
    );
    inactiveProduct = await p3Res.json();
    await deactivateProductRoute(
      new NextRequest(`http://localhost:3000/api/products/${inactiveProduct.id}/deactivate`, {
        method: 'POST',
        headers: { cookie: supervisorCookie },
      }),
      { params: { productId: inactiveProduct.id } }
    );
  });

  afterAll(async () => {
    await closePool();
  });

  it('US-02: Rejects document creation with empty supplier name (400 VALIDATION_ERROR)', async () => {
    const res = await createDocumentRoute(
      new NextRequest('http://localhost:3000/api/receiving-documents', {
        method: 'POST',
        body: JSON.stringify({
          supplierName: '   ',
        }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.field).toBe('supplierName');
  });

  it('BR-15: Operator creates receiving document in DRAFT with generated RD number (201)', async () => {
    const res = await createDocumentRoute(
      new NextRequest('http://localhost:3000/api/receiving-documents', {
        method: 'POST',
        body: JSON.stringify({
          supplierName: 'Pacific Rim Freight',
          referenceNumber: `PO-${Date.now().toString().slice(-6)}`,
          expectedArrivalDate: '2026-11-15',
          notes: 'Standard dock receiving',
        }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      })
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.documentNumber).toMatch(/^RD-[0-9]{4}-[0-9]{6}$/);
    expect(data.status).toBe('DRAFT');
    expect(data.supplierName).toBe('Pacific Rim Freight');
    expect(data.totals.lineCount).toBe(0);
    expect(data.totals.expectedQty).toBe(0);
  });

  it('BR-14: Rejects duplicate reference number for same supplier (409 DUPLICATE_REFERENCE)', async () => {
    const ref = `REF-DUP-${Date.now().toString().slice(-5)}`;

    // Create first document
    const res1 = await createDocumentRoute(
      new NextRequest('http://localhost:3000/api/receiving-documents', {
        method: 'POST',
        body: JSON.stringify({
          supplierName: 'Global Shipping Ltd',
          referenceNumber: ref,
        }),
        headers: { 'Content-Type': 'application/json', cookie: supervisorCookie },
      })
    );
    expect(res1.status).toBe(201);

    // Attempt second document with exact same supplier and reference
    const res2 = await createDocumentRoute(
      new NextRequest('http://localhost:3000/api/receiving-documents', {
        method: 'POST',
        body: JSON.stringify({
          supplierName: 'global shipping ltd', // case insensitive check
          referenceNumber: ref,
        }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      })
    );
    expect(res2.status).toBe(409);
    const data2 = await res2.json();
    expect(data2.code).toBe('DUPLICATE_REFERENCE');
  });

  it('US-03: Adds active product line to DRAFT document (201)', async () => {
    // 1. Create document
    const docRes = await createDocumentRoute(
      new NextRequest('http://localhost:3000/api/receiving-documents', {
        method: 'POST',
        body: JSON.stringify({
          supplierName: 'Line Test Supplier',
        }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      })
    );
    const doc = await docRes.json();

    // 2. Add line
    const lineRes = await addLineRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/lines`, {
        method: 'POST',
        body: JSON.stringify({
          productId: activeProduct1.id,
          expectedQty: 25,
        }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );

    expect(lineRes.status).toBe(201);
    const line = await lineRes.json();
    expect(line.id).toBeDefined();
    expect(line.product.id).toBe(activeProduct1.id);
    expect(line.expectedQty).toBe(25);
    expect(line.receivedQty).toBe(0);
    expect(line.remainingQty).toBe(25);
  });

  it('BR-11 / US-03: Rejects duplicate product on same document (409 DUPLICATE_PRODUCT_ON_DOCUMENT)', async () => {
    const docRes = await createDocumentRoute(
      new NextRequest('http://localhost:3000/api/receiving-documents', {
        method: 'POST',
        body: JSON.stringify({ supplierName: 'Dup Line Supplier' }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      })
    );
    const doc = await docRes.json();

    // First line
    await addLineRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/lines`, {
        method: 'POST',
        body: JSON.stringify({ productId: activeProduct1.id, expectedQty: 10 }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );

    // Duplicate line
    const dupRes = await addLineRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/lines`, {
        method: 'POST',
        body: JSON.stringify({ productId: activeProduct1.id, expectedQty: 5 }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );

    expect(dupRes.status).toBe(409);
    const data = await dupRes.json();
    expect(data.code).toBe('DUPLICATE_PRODUCT_ON_DOCUMENT');
  });

  it('BR-12 / US-03: Rejects inactive product with 422 PRODUCT_INACTIVE', async () => {
    const docRes = await createDocumentRoute(
      new NextRequest('http://localhost:3000/api/receiving-documents', {
        method: 'POST',
        body: JSON.stringify({ supplierName: 'Inactive Prod Supplier' }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      })
    );
    const doc = await docRes.json();

    const inactRes = await addLineRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/lines`, {
        method: 'POST',
        body: JSON.stringify({ productId: inactiveProduct.id, expectedQty: 10 }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );

    expect(inactRes.status).toBe(422);
    const data = await inactRes.json();
    expect(data.code).toBe('PRODUCT_INACTIVE');
  });

  it('US-04: Submitting document with 0 lines is rejected with 422 NO_LINES', async () => {
    const docRes = await createDocumentRoute(
      new NextRequest('http://localhost:3000/api/receiving-documents', {
        method: 'POST',
        body: JSON.stringify({ supplierName: 'Empty Doc Supplier' }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      })
    );
    const doc = await docRes.json();

    const submitRes = await submitDocumentRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/submit`, {
        method: 'POST',
        headers: { cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );

    expect(submitRes.status).toBe(422);
    const data = await submitRes.json();
    expect(data.code).toBe('NO_LINES');
  });

  it('US-04 & FR-08: Submitting document with lines moves to OPEN; enforces post-submit permissions', async () => {
    // 1. Create document with line
    const docRes = await createDocumentRoute(
      new NextRequest('http://localhost:3000/api/receiving-documents', {
        method: 'POST',
        body: JSON.stringify({ supplierName: 'Lifecycle Supplier' }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      })
    );
    const doc = await docRes.json();

    const lineRes = await addLineRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/lines`, {
        method: 'POST',
        body: JSON.stringify({ productId: activeProduct1.id, expectedQty: 10 }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );
    const line = await lineRes.json();

    // 2. Submit document
    const submitRes = await submitDocumentRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/submit`, {
        method: 'POST',
        headers: { cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );
    expect(submitRes.status).toBe(200);
    const submittedDoc = await submitRes.json();
    expect(submittedDoc.status).toBe('OPEN');
    expect(submittedDoc.submittedAt).toBeDefined();

    // 3. Adding line on OPEN doc is rejected with 409 INVALID_DOCUMENT_STATE
    const addAfterSubmitRes = await addLineRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/lines`, {
        method: 'POST',
        body: JSON.stringify({ productId: activeProduct2.id, expectedQty: 5 }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );
    expect(addAfterSubmitRes.status).toBe(409);

    // 4. Operator editing line on OPEN doc is rejected with 403 FORBIDDEN
    const opLineEditRes = await updateLineRoute(
      new NextRequest(
        `http://localhost:3000/api/receiving-documents/${doc.id}/lines/${line.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ expectedQty: 20 }),
          headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
        }
      ),
      { params: { documentId: doc.id, lineId: line.id } }
    );
    expect(opLineEditRes.status).toBe(403);

    // 5. Supervisor editing line on OPEN doc is allowed (FR-09)
    const supLineEditRes = await updateLineRoute(
      new NextRequest(
        `http://localhost:3000/api/receiving-documents/${doc.id}/lines/${line.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ expectedQty: 20 }),
          headers: { 'Content-Type': 'application/json', cookie: supervisorCookie },
        }
      ),
      { params: { documentId: doc.id, lineId: line.id } }
    );
    expect(supLineEditRes.status).toBe(200);
    const updatedLine = await supLineEditRes.json();
    expect(updatedLine.expectedQty).toBe(20);

    // 6. Supervisor attempting to edit supplierName on OPEN doc is rejected with 403 FORBIDDEN
    const supHeaderEditRes = await updateDocumentHeaderRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ supplierName: 'New Supplier Name' }),
        headers: { 'Content-Type': 'application/json', cookie: supervisorCookie },
      }),
      { params: { documentId: doc.id } }
    );
    expect(supHeaderEditRes.status).toBe(403);

    // 7. Supervisor editing notes on OPEN doc is allowed
    const supNotesEditRes = await updateDocumentHeaderRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: 'Supervisor updated note for open doc' }),
        headers: { 'Content-Type': 'application/json', cookie: supervisorCookie },
      }),
      { params: { documentId: doc.id } }
    );
    expect(supNotesEditRes.status).toBe(200);
  });

  it('FR-13 & BR-07: Cancellation rules and Operator restriction', async () => {
    // 1. Create document
    const docRes = await createDocumentRoute(
      new NextRequest('http://localhost:3000/api/receiving-documents', {
        method: 'POST',
        body: JSON.stringify({ supplierName: 'Cancel Test Supplier' }),
        headers: { 'Content-Type': 'application/json', cookie: operatorCookie },
      })
    );
    const doc = await docRes.json();

    // 2. Operator cannot cancel document (403 FORBIDDEN)
    const opCancelRes = await cancelDocumentRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/cancel`, {
        method: 'POST',
        headers: { cookie: operatorCookie },
      }),
      { params: { documentId: doc.id } }
    );
    expect(opCancelRes.status).toBe(403);

    // 3. Supervisor can cancel document with 0 receipts (200)
    const supCancelRes = await cancelDocumentRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}/cancel`, {
        method: 'POST',
        headers: { cookie: supervisorCookie },
      }),
      { params: { documentId: doc.id } }
    );
    expect(supCancelRes.status).toBe(200);
    const cancelledDoc = await supCancelRes.json();
    expect(cancelledDoc.status).toBe('CANCELLED');

    // 4. Modifying cancelled document is rejected with 409 INVALID_DOCUMENT_STATE
    const modifyCancelledRes = await updateDocumentHeaderRoute(
      new NextRequest(`http://localhost:3000/api/receiving-documents/${doc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: 'Will fail' }),
        headers: { 'Content-Type': 'application/json', cookie: supervisorCookie },
      }),
      { params: { documentId: doc.id } }
    );
    expect(modifyCancelledRes.status).toBe(409);
  });

  it('List receiving documents with status and search filters (200)', async () => {
    const listRes = await getDocumentsRoute(
      new NextRequest('http://localhost:3000/api/receiving-documents?status=DRAFT&page=1&pageSize=10', {
        headers: { cookie: operatorCookie },
      })
    );
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.data).toBeInstanceOf(Array);
    expect(listData.pagination.total).toBeGreaterThanOrEqual(1);
  });
});
