import { cookies } from 'next/headers';
import { AppError } from '../errors';
import { hashToken } from './token';
import { findActiveSessionWithUser } from '../repositories/session.repository';
import { CurrentUser, Role, User } from '@/src/types/domain';

export function getTokenFromCookies(): string | null {
  try {
    const cookieStore = cookies();
    return cookieStore.get('session')?.value || null;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith('session=')) {
      return decodeURIComponent(cookie.substring('session='.length));
    }
  }

  return null;
}

export async function requireAuth(request: Request): Promise<User> {
  const token = getTokenFromRequest(request) || getTokenFromCookies();
  if (!token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  const sessionId = hashToken(token);
  const active = await findActiveSessionWithUser(sessionId);

  if (!active) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Missing or expired session.');
  }

  return active.user;
}

export function requireRole(user: User | CurrentUser, allowedRoles: Role[]): void {
  if (!allowedRoles.includes(user.role)) {
    throw new AppError(
      403,
      'FORBIDDEN',
      `Forbidden: Role ${user.role} is not permitted to perform this action.`
    );
  }
}

export function validateOrigin(request: Request): void {
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return;
  }

  const origin = request.headers.get('origin');
  if (!origin) {
    // Requests without Origin (e.g. CLI, curl, automated test suites) are permitted
    return;
  }

  const host = request.headers.get('host');
  if (!host) {
    return;
  }

  // Parse origin and verify against Host header
  try {
    const originUrl = new URL(origin);
    if (originUrl.host !== host) {
      throw new AppError(403, 'FORBIDDEN', 'Cross-origin request rejected.');
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(403, 'FORBIDDEN', 'Invalid request origin.');
  }
}
