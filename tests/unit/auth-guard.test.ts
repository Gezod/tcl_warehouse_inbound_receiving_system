import { describe, it, expect } from 'vitest';
import { requireRole, validateOrigin } from '@/src/server/auth/guard';
import { AppError } from '@/src/server/errors';
import { CurrentUser } from '@/src/types/domain';
import { loginSchema } from '@/src/lib/validation/auth.schema';

describe('Auth Guard Unit Tests', () => {
  const operatorUser: CurrentUser = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    username: 'operator',
    fullName: 'Warehouse Operator',
    role: 'OPERATOR',
  };

  const supervisorUser: CurrentUser = {
    id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    username: 'supervisor',
    fullName: 'Warehouse Supervisor',
    role: 'SUPERVISOR',
  };

  it('requireRole allows permitted role', () => {
    expect(() => requireRole(operatorUser, ['OPERATOR', 'SUPERVISOR'])).not.toThrow();
    expect(() => requireRole(supervisorUser, ['SUPERVISOR'])).not.toThrow();
  });

  it('requireRole throws 403 FORBIDDEN when Operator calls Supervisor-only action', () => {
    expect(() => requireRole(operatorUser, ['SUPERVISOR'])).toThrowError(AppError);
    try {
      requireRole(operatorUser, ['SUPERVISOR']);
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
    }
  });

  it('validateOrigin rejects cross-origin mutations with 403', () => {
    const request = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
        origin: 'http://evil-site.com',
      },
    });

    expect(() => validateOrigin(request)).toThrowError(AppError);
    try {
      validateOrigin(request);
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
    }
  });

  it('validateOrigin permits requests with matching origin or no origin header', () => {
    const validOriginRequest = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      },
    });
    expect(() => validateOrigin(validOriginRequest)).not.toThrow();

    const noOriginRequest = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
      },
    });
    expect(() => validateOrigin(noOriginRequest)).not.toThrow();
  });

  it('loginSchema enforces validation constraints', () => {
    expect(() => loginSchema.parse({ username: 'op', password: 'password123' })).toThrow();
    expect(() => loginSchema.parse({ username: 'operator', password: '123' })).toThrow();
    expect(() =>
      loginSchema.parse({ username: 'operator', password: 'ValidPassword123!' })
    ).not.toThrow();
  });
});
