import crypto from 'crypto';
import { getEnv } from '../config/env';

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getSessionCookieHeader(token: string): string {
  const env = getEnv();
  const maxAge = env.SESSION_TTL_HOURS * 3600;
  const isProd = env.NODE_ENV === 'production';

  const parts = [
    `session=${token}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (isProd) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function getClearSessionCookieHeader(): string {
  const env = getEnv();
  const isProd = env.NODE_ENV === 'production';

  const parts = [
    'session=',
    'Max-Age=0',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (isProd) {
    parts.push('Secure');
  }

  return parts.join('; ');
}
