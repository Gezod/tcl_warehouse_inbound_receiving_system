import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';
import { NextRequest } from 'next/server';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { GET as getProductsRoute, POST as createProductRoute } from '@/app/api/products/route';
import {
  GET as getProductDetailRoute,
  PATCH as updateProductRoute,
} from '@/app/api/products/[productId]/route';
import { POST as deactivateProductRoute } from '@/app/api/products/[productId]/deactivate/route';
import { getPool, closePool } from '@/src/server/db/pool';

dotenv.config();

describe('Products API Integration Tests (against PostgreSQL)', () => {
  let operatorCookie: string;
  let supervisorCookie: string;

  beforeAll(async () => {
    const pool = getPool();
    const client = await pool.connect();
    client.release();

    // 1. Authenticate as Operator
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

    // 2. Authenticate as Supervisor
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
  });

  afterAll(async () => {
    await closePool();
  });

  it('Operator cannot create a product (403 FORBIDDEN)', async () => {
    const req = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify({
        sku: 'OP-PROD-01',
        name: 'Operator Product',
        baseUnit: 'pcs',
      }),
      headers: {
        'Content-Type': 'application/json',
        cookie: operatorCookie,
      },
    });

    const res = await createProductRoute(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('FORBIDDEN');
  });

  it('Supervisor successfully creates a product with normalized uppercase SKU (201)', async () => {
    const req = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify({
        sku: '  sku-abc-001  ', // lower case with whitespace
        name: 'Industrial Widget A',
        baseUnit: 'box',
      }),
      headers: {
        'Content-Type': 'application/json',
        cookie: supervisorCookie,
      },
    });

    const res = await createProductRoute(req);
    expect(res.status).toBe(201);
    const data = await res.json();

    expect(data.id).toBeDefined();
    expect(data.sku).toBe('SKU-ABC-001'); // Normalized upper case
    expect(data.name).toBe('Industrial Widget A');
    expect(data.baseUnit).toBe('box');
    expect(data.isActive).toBe(true);
    expect(data.hasTransactions).toBe(false);
  });

  it('BR-01: Rejects duplicate SKU case-insensitively with 409 DUPLICATE_SKU', async () => {
    // Attempt to create "sku-abc-001" which matches existing "SKU-ABC-001"
    const req = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify({
        sku: 'sku-abc-001',
        name: 'Duplicate Widget',
        baseUnit: 'pcs',
      }),
      headers: {
        'Content-Type': 'application/json',
        cookie: supervisorCookie,
      },
    });

    const res = await createProductRoute(req);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('DUPLICATE_SKU');
    expect(data.field).toBe('sku');
  });

  it('Both Operator and Supervisor can list products with search and pagination (200)', async () => {
    // Operator listing
    const opReq = new NextRequest('http://localhost:3000/api/products?q=widget&page=1&pageSize=10', {
      headers: { cookie: operatorCookie },
    });
    const opRes = await getProductsRoute(opReq);
    expect(opRes.status).toBe(200);

    const opData = await opRes.json();
    expect(opData.data).toBeInstanceOf(Array);
    expect(opData.data.length).toBeGreaterThanOrEqual(1);
    expect(opData.pagination.total).toBeGreaterThanOrEqual(1);
    expect(opData.data[0].sku).toBe('SKU-ABC-001');

    // Supervisor listing
    const supReq = new NextRequest('http://localhost:3000/api/products', {
      headers: { cookie: supervisorCookie },
    });
    const supRes = await getProductsRoute(supReq);
    expect(supRes.status).toBe(200);
  });

  it('Supervisor updates product name and baseUnit (200)', async () => {
    // First fetch product id
    const listReq = new NextRequest('http://localhost:3000/api/products?q=SKU-ABC-001', {
      headers: { cookie: supervisorCookie },
    });
    const listRes = await getProductsRoute(listReq);
    const listData = await listRes.json();
    const product = listData.data[0];

    // Update name
    const updateReq = new NextRequest(`http://localhost:3000/api/products/${product.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Industrial Widget A - Updated',
        baseUnit: 'pallet',
      }),
      headers: {
        'Content-Type': 'application/json',
        cookie: supervisorCookie,
      },
    });

    const updateRes = await updateProductRoute(updateReq, { params: { productId: product.id } });
    expect(updateRes.status).toBe(200);
    const updatedData = await updateRes.json();
    expect(updatedData.name).toBe('Industrial Widget A - Updated');
    expect(updatedData.baseUnit).toBe('pallet');
  });

  it('FR-03: SKU is locked after transactions or receiving lines exist (409 SKU_LOCKED)', async () => {
    const pool = getPool();

    // 1. Create a product for this test
    const createReq = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify({
        sku: 'SKU-LOCK-TEST',
        name: 'Lock Test Item',
        baseUnit: 'pcs',
      }),
      headers: {
        'Content-Type': 'application/json',
        cookie: supervisorCookie,
      },
    });
    const createRes = await createProductRoute(createReq);
    expect(createRes.status).toBe(201);
    const testProduct = await createRes.json();

    // Verify SKU can be changed while hasTransactions is false
    const preLockUpdate = await updateProductRoute(
      new NextRequest(`http://localhost:3000/api/products/${testProduct.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ sku: 'SKU-LOCK-RENAMED' }),
        headers: { 'Content-Type': 'application/json', cookie: supervisorCookie },
      }),
      { params: { productId: testProduct.id } }
    );
    expect(preLockUpdate.status).toBe(200);

    // 2. Insert a simulated receiving line for this product to lock it
    const userRes = await pool.query("SELECT id FROM users WHERE username = 'supervisor' LIMIT 1");
    const supervisorId = userRes.rows[0].id;

    const docRes = await pool.query(
      `INSERT INTO receiving_documents (document_number, status, supplier_name, supplier_key, created_by)
       VALUES ('RD-2026-999991', 'DRAFT', 'Test Supplier', 'test supplier', $1)
       RETURNING id;`,
      [supervisorId]
    );
    const docId = docRes.rows[0].id;

    await pool.query(
      `INSERT INTO receiving_lines (document_id, product_id, expected_qty, received_qty)
       VALUES ($1, $2, 10, 0);`,
      [docId, testProduct.id]
    );

    // 3. Now verify product detail reports hasTransactions = true
    const detailReq = new NextRequest(`http://localhost:3000/api/products/${testProduct.id}`, {
      headers: { cookie: supervisorCookie },
    });
    const detailRes = await getProductDetailRoute(detailReq, { params: { productId: testProduct.id } });
    const detailData = await detailRes.json();
    expect(detailData.hasTransactions).toBe(true);

    // 4. Attempt to change SKU now -> must be rejected with 409 SKU_LOCKED
    const lockedUpdateReq = new NextRequest(`http://localhost:3000/api/products/${testProduct.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ sku: 'SKU-LOCK-ATTEMPT-2' }),
      headers: {
        'Content-Type': 'application/json',
        cookie: supervisorCookie,
      },
    });
    const lockedUpdateRes = await updateProductRoute(lockedUpdateReq, {
      params: { productId: testProduct.id },
    });
    expect(lockedUpdateRes.status).toBe(409);
    const lockedData = await lockedUpdateRes.json();
    expect(lockedData.code).toBe('SKU_LOCKED');

    // 5. Updating name or unit while locked is still allowed
    const nameUpdateReq = new NextRequest(`http://localhost:3000/api/products/${testProduct.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Still Editable Name' }),
      headers: {
        'Content-Type': 'application/json',
        cookie: supervisorCookie,
      },
    });
    const nameUpdateRes = await updateProductRoute(nameUpdateReq, {
      params: { productId: testProduct.id },
    });
    expect(nameUpdateRes.status).toBe(200);
  });

  it('FR-04 & BR-12: Deactivate product is idempotent and rejects Operator with 403', async () => {
    // 1. Create product to deactivate
    const createReq = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify({
        sku: 'SKU-DEACT-01',
        name: 'Deactivatable Product',
        baseUnit: 'pcs',
      }),
      headers: {
        'Content-Type': 'application/json',
        cookie: supervisorCookie,
      },
    });
    const createRes = await createProductRoute(createReq);
    const product = await createRes.json();

    // 2. Operator attempting deactivation gets 403 FORBIDDEN
    const opDeactReq = new NextRequest(
      `http://localhost:3000/api/products/${product.id}/deactivate`,
      {
        method: 'POST',
        headers: { cookie: operatorCookie },
      }
    );
    const opDeactRes = await deactivateProductRoute(opDeactReq, {
      params: { productId: product.id },
    });
    expect(opDeactRes.status).toBe(403);

    // 3. Supervisor deactivates product -> returns 200, isActive=false
    const supDeactReq = new NextRequest(
      `http://localhost:3000/api/products/${product.id}/deactivate`,
      {
        method: 'POST',
        headers: { cookie: supervisorCookie },
      }
    );
    const supDeactRes = await deactivateProductRoute(supDeactReq, {
      params: { productId: product.id },
    });
    expect(supDeactRes.status).toBe(200);
    const deactData = await supDeactRes.json();
    expect(deactData.isActive).toBe(false);

    // 4. Repeated deactivation is idempotent -> returns 200 with current state
    const repeatDeactRes = await deactivateProductRoute(supDeactReq, {
      params: { productId: product.id },
    });
    expect(repeatDeactRes.status).toBe(200);
    const repeatData = await repeatDeactRes.json();
    expect(repeatData.isActive).toBe(false);
  });
});
