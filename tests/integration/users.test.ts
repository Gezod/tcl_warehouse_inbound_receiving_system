import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';
import { NextRequest } from 'next/server';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { GET as getUsersRoute, POST as createUserRoute } from '@/app/api/users/route';
import { PATCH as updateUserRoute } from '@/app/api/users/[userId]/route';
import { getPool, closePool } from '@/src/server/db/pool';

dotenv.config();

describe('Users API Integration Tests (against PostgreSQL)', () => {
  let operatorCookie: string;
  let supervisorCookie: string;
  const runId = Math.random().toString(36).substring(2, 7).toLowerCase();

  beforeAll(async () => {
    const pool = getPool();
    const client = await pool.connect();
    client.release();

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
  });

  afterAll(async () => {
    // Cleanup users created during test run
    const pool = getPool();
    await pool.query(`DELETE FROM users WHERE username LIKE 'test.user.%' OR username LIKE 'test.sup.%';`);
    await closePool();
  });

  it('rejects unauthenticated requests to /api/users with 401', async () => {
    const res = await getUsersRoute(new NextRequest('http://localhost:3000/api/users'));
    expect(res.status).toBe(401);
  });

  it('rejects Operator access to user endpoints with 403 FORBIDDEN', async () => {
    // 1. GET /api/users
    const getRes = await getUsersRoute(
      new NextRequest('http://localhost:3000/api/users', {
        headers: { Cookie: operatorCookie },
      })
    );
    expect(getRes.status).toBe(403);
    const getBody = await getRes.json();
    expect(getBody.code).toBe('FORBIDDEN');

    // 2. POST /api/users
    const postRes = await createUserRoute(
      new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: `test.user.op.${runId}`,
          fullName: 'Test User',
          role: 'OPERATOR',
          password: 'Password123!',
        }),
        headers: {
          Cookie: operatorCookie,
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
      })
    );
    expect(postRes.status).toBe(403);

    // 3. PATCH /api/users/[id]
    const patchRes = await updateUserRoute(
      new NextRequest('http://localhost:3000/api/users/00000000-0000-0000-0000-000000000000', {
        method: 'PATCH',
        body: JSON.stringify({ fullName: 'Hacked Name' }),
        headers: {
          Cookie: operatorCookie,
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
      }),
      { params: { userId: '00000000-0000-0000-0000-000000000000' } }
    );
    expect(patchRes.status).toBe(403);
  });

  it('allows Supervisor to list users with pagination', async () => {
    const res = await getUsersRoute(
      new NextRequest('http://localhost:3000/api/users?page=1&pageSize=10', {
        headers: { Cookie: supervisorCookie },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(10);
    expect(typeof body.pagination.total).toBe('number');
    expect(body.pagination.total).toBeGreaterThanOrEqual(2); // at least seeded supervisor & operator
  });

  let createdUserId: string;
  const username1 = `test.user.${runId}`;

  it('allows Supervisor to create a new user (201)', async () => {
    const res = await createUserRoute(
      new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: username1,
          fullName: 'Test Operator User',
          role: 'OPERATOR',
          password: 'UserPass123!',
        }),
        headers: {
          Cookie: supervisorCookie,
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.username).toBe(username1);
    expect(body.fullName).toBe('Test Operator User');
    expect(body.role).toBe('OPERATOR');
    expect(body.isActive).toBe(true);
    expect(body.passwordHash).toBeUndefined(); // Secrets must never be leaked
    createdUserId = body.id;
  });

  it('rejects duplicate username with 409 DUPLICATE_USERNAME', async () => {
    const res = await createUserRoute(
      new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: username1.toUpperCase(), // Case insensitive duplicate test
          fullName: 'Duplicate User',
          role: 'OPERATOR',
          password: 'UserPass123!',
        }),
        headers: {
          Cookie: supervisorCookie,
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
      })
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('DUPLICATE_USERNAME');
    expect(body.field).toBe('username');
  });

  it('allows Supervisor to update a user (200)', async () => {
    const res = await updateUserRoute(
      new NextRequest(`http://localhost:3000/api/users/${createdUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: 'Updated Test Operator',
          isActive: false,
        }),
        headers: {
          Cookie: supervisorCookie,
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
      }),
      { params: { userId: createdUserId } }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(createdUserId);
    expect(body.fullName).toBe('Updated Test Operator');
    expect(body.isActive).toBe(false);
  });

  it('enforces Last Active Supervisor protection rule (409 LAST_SUPERVISOR_ACTION_FORBIDDEN)', async () => {
    const pool = getPool();
    // Fetch supervisor user id
    const supRes = await pool.query(`SELECT id FROM users WHERE username = 'supervisor' LIMIT 1;`);
    const seededSupervisorId = supRes.rows[0].id;

    // Ensure only 1 active supervisor exists currently
    const supCountRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM users WHERE role = 'SUPERVISOR' AND is_active = true;`
    );
    const currentActiveSupervisors = supCountRes.rows[0].count;

    // If there is only 1 supervisor, attempting to deactivate or demote should return 409
    if (currentActiveSupervisors === 1) {
      const deactRes = await updateUserRoute(
        new NextRequest(`http://localhost:3000/api/users/${seededSupervisorId}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: false }),
          headers: {
            Cookie: supervisorCookie,
            'Content-Type': 'application/json',
            Origin: 'http://localhost:3000',
          },
        }),
        { params: { userId: seededSupervisorId } }
      );

      expect(deactRes.status).toBe(409);
      const deactBody = await deactRes.json();
      expect(deactBody.code).toBe('LAST_SUPERVISOR_ACTION_FORBIDDEN');
    }

    // Now create a 2nd active supervisor
    const secondSupRes = await createUserRoute(
      new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: `test.sup.${runId}`,
          fullName: 'Second Supervisor',
          role: 'SUPERVISOR',
          password: 'SupPassword123!',
        }),
        headers: {
          Cookie: supervisorCookie,
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
      })
    );
    expect(secondSupRes.status).toBe(201);
    const secondSup = await secondSupRes.json();

    // Now that 2 active supervisors exist, deactivating one of them succeeds
    const deactSecondRes = await updateUserRoute(
      new NextRequest(`http://localhost:3000/api/users/${secondSup.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
        headers: {
          Cookie: supervisorCookie,
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
      }),
      { params: { userId: secondSup.id } }
    );
    expect(deactSecondRes.status).toBe(200);
    const deactSecondBody = await deactSecondRes.json();
    expect(deactSecondBody.isActive).toBe(false);
  });
});
