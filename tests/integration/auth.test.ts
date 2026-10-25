import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';
import { NextRequest } from 'next/server';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { POST as logoutRoute } from '@/app/api/auth/logout/route';
import { GET as meRoute } from '@/app/api/auth/me/route';
import { requireAuth, requireRole } from '@/src/server/auth/guard';
import { getPool, closePool } from '@/src/server/db/pool';

dotenv.config();

describe('Auth Integration Tests (against real PostgreSQL)', () => {
  beforeAll(async () => {
    const pool = getPool();
    const client = await pool.connect();
    client.release();
  });

  afterAll(async () => {
    await closePool();
  });

  it('rejects invalid credentials for non-existent user with 401 INVALID_CREDENTIALS', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'nonexistent_user',
        password: 'RandomPassword123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await loginRoute(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.code).toBe('INVALID_CREDENTIALS');
    expect(data.message).toBe('Username or password is incorrect.');
  });

  it('rejects wrong password for existing user with 401 INVALID_CREDENTIALS', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'operator',
        password: 'WrongPassword999!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await loginRoute(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects request with missing or malformed body with 400 VALIDATION_ERROR', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'op',
        password: '123',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await loginRoute(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('GET /auth/me returns 401 UNAUTHENTICATED without session cookie', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/me');
    const res = await meRoute(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.code).toBe('UNAUTHENTICATED');
  });

  it('full login, me, and logout lifecycle for Operator', async () => {
    // 1. Login as operator
    const loginReq = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'operator',
        password: 'OperatorPass123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const loginRes = await loginRoute(loginReq);
    expect(loginRes.status).toBe(200);

    const userData = await loginRes.json();
    expect(userData.username).toBe('operator');
    expect(userData.role).toBe('OPERATOR');
    expect(userData.fullName).toBe('Warehouse Operator');

    const cookieHeader = loginRes.headers.get('set-cookie');
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader).toContain('session=');
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('SameSite=Lax');

    // Extract cookie value for subsequent requests
    const sessionCookie = cookieHeader!.split(';')[0];

    // 2. GET /auth/me with session cookie
    const meReq = new NextRequest('http://localhost:3000/api/auth/me', {
      headers: { cookie: sessionCookie },
    });
    const meRes = await meRoute(meReq);
    expect(meRes.status).toBe(200);

    const meData = await meRes.json();
    expect(meData.id).toBe(userData.id);
    expect(meData.username).toBe('operator');
    expect(meData.role).toBe('OPERATOR');

    // 3. Verify role guard: Operator calling a Supervisor-only action throws 403
    const authenticatedUser = await requireAuth(meReq);
    expect(authenticatedUser.role).toBe('OPERATOR');
    expect(() => requireRole(authenticatedUser, ['SUPERVISOR'])).toThrowError(/Forbidden/);

    // 4. Logout
    const logoutReq = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: { cookie: sessionCookie },
    });
    const logoutRes = await logoutRoute(logoutReq);
    expect(logoutRes.status).toBe(204);

    const clearCookieHeader = logoutRes.headers.get('set-cookie');
    expect(clearCookieHeader).toContain('Max-Age=0');

    // 5. Subsequent GET /auth/me with revoked session returns 401
    const postLogoutReq = new NextRequest('http://localhost:3000/api/auth/me', {
      headers: { cookie: sessionCookie },
    });
    const postLogoutRes = await meRoute(postLogoutReq);
    expect(postLogoutRes.status).toBe(401);
  });

  it('successful login and role guard verification for Supervisor', async () => {
    const loginReq = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'supervisor',
        password: 'SupervisorPass123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const loginRes = await loginRoute(loginReq);
    expect(loginRes.status).toBe(200);

    const userData = await loginRes.json();
    expect(userData.username).toBe('supervisor');
    expect(userData.role).toBe('SUPERVISOR');

    const cookieHeader = loginRes.headers.get('set-cookie')!;
    const sessionCookie = cookieHeader.split(';')[0];

    const meReq = new NextRequest('http://localhost:3000/api/auth/me', {
      headers: { cookie: sessionCookie },
    });

    const supervisorUser = await requireAuth(meReq);
    expect(supervisorUser.role).toBe('SUPERVISOR');
    // Supervisor passes supervisor-only guard
    expect(() => requireRole(supervisorUser, ['SUPERVISOR'])).not.toThrow();
  });
});
